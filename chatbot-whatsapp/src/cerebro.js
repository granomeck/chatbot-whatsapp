// O "cérebro": decide o que responder. Não depende do WhatsApp, por isso dá para testar no simulador.

const MARCADOR_HUMANO = '[CHAMAR_HUMANO]'
const MAX_HISTORICO = 12 // mensagens lembradas por cliente
const ESQUECER_APOS_MS = 6 * 60 * 60 * 1000 // conversa parada há 6h recomeça do zero

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const PEDIDO_HUMANO = /\b(atendente|humano|humana|especialista|gerente|vendedora?|uma pessoa|pessoa de verdade|alguem (de verdade|real|da loja|da equipe)|falar com (voce|vc|alguem|o dono|a dona|uma pessoa))\b/

export const pedeHumano = (texto) => PEDIDO_HUMANO.test(normalizar(texto))

// "08:00-18:00" (vazio = 24h). Funciona também virando a meia-noite: "18:00-02:00".
export function dentroDoHorario(horario, data = new Date()) {
  const m = (horario || '').match(/^\s*(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?\s*$/)
  if (!m) return true
  const inicio = Number(m[1]) * 60 + Number(m[2] || 0)
  const fim = Number(m[3]) * 60 + Number(m[4] || 0)
  const agora = data.getHours() * 60 + data.getMinutes()
  return inicio <= fim ? agora >= inicio && agora < fim : agora >= inicio || agora < fim
}

export function montarInstrucoes({ nomeNegocio, negocio, exemplos }) {
  return `Você é o atendente virtual de "${nomeNegocio}" no WhatsApp.

COMO RESPONDER
- Português do Brasil, simpático e curto (no máximo 3 frases), como numa conversa de WhatsApp.
- Use SOMENTE as informações do negócio abaixo. Nunca invente preço, prazo, estoque, endereço ou promoção.
- Faça uma pergunta por vez para entender o que o cliente precisa e conduza para a compra.
- Se não souber a resposta, ou se o cliente quiser fechar pedido, negociar, reclamar ou falar com alguém,
  diga que vai chamar uma pessoa da equipe e escreva ${MARCADOR_HUMANO} no final da resposta.
- Se perguntarem se você é um robô, diga a verdade: é um assistente virtual da loja.

INFORMAÇÕES DO NEGÓCIO
${negocio || '(o dono ainda não preencheu o arquivo meu-negocio.txt — chame uma pessoa para qualquer dúvida)'}
${exemplos ? `
EXEMPLOS DE CONVERSAS REAIS DA LOJA
Use para aprender o jeito de falar e as dúvidas mais comuns. Os dados podem estar desatualizados:
preços e promoções valem só os que estão nas INFORMAÇÕES DO NEGÓCIO.
${exemplos}` : ''}`
}

export function criarCerebro({ config, conhecimento, ia, agora = () => Date.now() }) {
  const instrucoes = montarInstrucoes({ nomeNegocio: config.nomeNegocio, ...conhecimento })
  const historicos = new Map() // numero -> { msgs: [], ultima: ms }
  const pausados = new Map() // numero -> pausado até (ms)
  const avisoMidia = new Map() // numero -> último aviso (ms)

  const pausar = (numero) => pausados.set(numero, agora() + config.pausaMinutos * 60 * 1000)
  const estaPausado = (numero) => (pausados.get(numero) || 0) > agora()

  function historicoDe(numero) {
    let h = historicos.get(numero)
    if (!h || agora() - h.ultima > ESQUECER_APOS_MS) {
      h = { msgs: [], ultima: agora() }
      historicos.set(numero, h)
    }
    h.ultima = agora()
    return h.msgs
  }

  function chamarHumano(numero, nome, texto, frase) {
    pausar(numero)
    return {
      respostas: [frase],
      chamarHumano: true,
      aviso: `🔔 Cliente pedindo atendimento!\nNome: ${nome || 'sem nome'}\nWhatsApp: https://wa.me/${numero}\nÚltima mensagem: "${texto}"\n\nO robô fica em silêncio com esse cliente por ${config.pausaMinutos} min.`,
    }
  }

  function filtro(numero) {
    if (!dentroDoHorario(config.horario, new Date(agora()))) return { ignorar: true, motivo: 'fora_do_horario' }
    if (estaPausado(numero)) return { ignorar: true, motivo: 'humano_atendendo' }
    return null
  }

  async function responder(numero, nome, texto) {
    const bloqueio = filtro(numero)
    if (bloqueio) return bloqueio
    if (!texto) return { ignorar: true, motivo: 'vazio' }

    const historico = historicoDe(numero)
    if (pedeHumano(texto)) {
      historico.push({ papel: 'cliente', texto })
      return chamarHumano(numero, nome, texto, 'Claro! Já chamei uma pessoa da equipe, em instantes ela te responde por aqui. 😊')
    }

    historico.push({ papel: 'cliente', texto })
    let resposta
    try {
      resposta = (await ia.gerar({ instrucoes, historico })).trim()
    } catch (erro) {
      historico.pop()
      if (erro.status === 429) {
        return { respostas: ['Estou com muitas mensagens agora 😅 Pode me mandar de novo daqui a 1 minutinho?'], erro: 'limite_da_ia' }
      }
      return { ...chamarHumano(numero, nome, texto, 'Tive um probleminha aqui, mas já chamei uma pessoa da equipe para te ajudar!'), erro: erro.message }
    }

    const precisaHumano = resposta.includes(MARCADOR_HUMANO)
    resposta = resposta.replaceAll(MARCADOR_HUMANO, '').trim() || 'Vou chamar uma pessoa da equipe para te ajudar!'
    historico.push({ papel: 'robo', texto: resposta })
    while (historico.length > MAX_HISTORICO) historico.shift()

    // respostas com parágrafos viram até 3 balões, como uma pessoa digitando
    const baloes = resposta.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    const respostas = baloes.length > 3 ? [baloes.slice(0, 2), baloes.slice(2).join('\n')].flat() : baloes

    if (precisaHumano) {
      const r = chamarHumano(numero, nome, texto, '')
      return { ...r, respostas }
    }
    return { respostas }
  }

  // áudio, foto, figurinha: avisa uma vez a cada 10 minutos
  function midia(numero) {
    const bloqueio = filtro(numero)
    if (bloqueio) return bloqueio
    if (agora() - (avisoMidia.get(numero) || 0) < 10 * 60 * 1000) return { ignorar: true, motivo: 'midia_repetida' }
    avisoMidia.set(numero, agora())
    return { respostas: ['Por enquanto eu só consigo ler mensagens de texto. Pode escrever sua dúvida? 😊'] }
  }

  return { responder, midia, instrucoes }
}

// tempo do "digitando...": proporcional ao tamanho da resposta, entre 1,5 e 5 segundos
export const tempoDigitando = (texto) => Math.min(5000, Math.max(1500, texto.length * 40))
