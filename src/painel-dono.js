// Painel do dono pelo WhatsApp: o dono configura e atualiza o robô mandando mensagens para ele.
// - Quando o robô conecta pela 1ª vez, manda para o dono a mensagem de configuração (2 passos).
// - Depois, o dono manda "atualizar" e escolhe o que mudar no menu.
// Só o número que está em SEU_WHATSAPP_PESSOAL consegue usar o painel.
// Não depende do WhatsApp: recebe { texto, documento } e devolve as respostas (dá para testar sem celular).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerExportacao } from './limpar-conversas.js'
import { textoDoZip } from './zip.js'

export const PROMPT_MEU_NEGOCIO = `Você vai me ajudar a escrever as informações do meu negócio para o meu atendente virtual de WhatsApp.
Vou te mandar fotos, prints, cardápio, tabela de preços e o link do meu site ou Instagram.
Organize tudo neste modelo, em texto simples (sem tabelas, sem negrito, sem emojis):

SOBRE O NEGÓCIO
(o que vende, endereço, cidade, se faz entrega)

HORÁRIO
(dias e horários de funcionamento)

PRODUTOS E PREÇOS
(um por linha, assim: Produto: R$ preço)

PROMOÇÕES
(Black Friday, Natal e fim de ano, com datas de início e fim)

PAGAMENTO E ENTREGA
(formas de pagamento, taxa e prazo de entrega, retirada, trocas)

PERGUNTAS FREQUENTES
(as dúvidas que os clientes mais fazem, com a resposta)

REGRAS PARA O ATENDENTE
(o que perguntar antes de passar um pedido e o que nunca prometer)

Regras: use só o que eu te mandar e não invente nada. Se faltar alguma informação importante, me pergunte antes de terminar. No final, me entregue só o texto pronto, para eu copiar.

As informações do meu negócio são estas:
(cole aqui, ou anexe as fotos, prints e links)`

const EXPIRA_MENU_MS = 30 * 60 * 1000 // menu parado por 30 min fecha sozinho
const EXPIRA_CONFIGURACAO_MS = 24 * 60 * 60 * 1000 // a configuração inicial espera até 24h
const TEXTO_MINIMO = 80 // menos que isso não parece um texto de negócio completo

const soDigitos = (t = '') => String(t).replace(/\D/g, '')

// "1️⃣", "*Pronto!*", "Atualizar." -> "1", "pronto", "atualizar"
export const limparComando = (texto = '') =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s:-]/gu, '').trim()

// Compara números do Brasil com e sem o 9 da frente (o WhatsApp de alguns números antigos não tem o 9)
export function mesmoNumero(a, b) {
  const x = soDigitos(a)
  const y = soDigitos(b)
  if (!x || !y) return false
  const sem9 = (n) => (n.length === 13 && n.startsWith('55') && n[4] === '9' ? n.slice(0, 4) + n.slice(5) : n)
  return sem9(x) === sem9(y)
}

// "08:00-18:00", "8h as 18h", "8 a 18", "24h" -> "08:00-18:00" ou '' (24 horas); null = não entendi
export function lerHorario(texto) {
  const t = limparComando(texto)
  if (['24h', '24 h', '24', '24 horas', '24hs', 'dia todo', 'sempre'].includes(t)) return ''
  const m = t.match(/^(\d{1,2})(?:[:h](\d{2})?)?\s*(?:-|a|as|ate)\s*(\d{1,2})(?:[:h](\d{2})?)?\s*(?:h|hs)?$/)
  if (!m) return null
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] || 0), Number(m[3]), Number(m[4] || 0)]
  if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) return null
  const f = (h, mi) => `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  return `${f(h1, m1)}-${f(h2, m2)}`
}

export function criarPainelDono({
  pasta = '.',
  config, // { nomeNegocio, horario } — o horário é trocado aqui mesmo quando o dono muda
  ajustes, // objeto de src/ajustes.js (é alterado aqui)
  salvarAjustes = () => {},
  recarregar = () => ({ totalConversas: 0 }), // relê meu-negocio.txt e conversas/ e atualiza o robô
  listarGrupos = async () => [], // [{ jid, nome }] dos grupos em que o robô está
  agora = () => Date.now(),
}) {
  let estado = null // null | 'conversas' | 'negocio' | 'menu' | 'horario' | 'avisos'
  let configurando = false // está nos 2 passos da configuração inicial?
  let ultimaAtividade = 0
  let opcoesGrupos = []

  const arquivoNegocio = join(pasta, 'meu-negocio.txt')
  const arquivoAnterior = join(pasta, 'meu-negocio.anterior.txt')
  const pastaConversas = join(pasta, 'conversas')

  const destino = () => (ajustes.grupoAvisos ? `o grupo "${ajustes.grupoAvisos.nome}"` : 'o seu WhatsApp pessoal')
  const horarioTexto = () => (config.horario ? config.horario : '24 horas')
  const textoNegocio = () => (existsSync(arquivoNegocio) ? readFileSync(arquivoNegocio, 'utf8').trim() : '')
  const ehExemplo = (t) => /APAGUE ESTE EXEMPLO/i.test(t)
  const rodape = '\n\nQuer mudar mais alguma coisa? Mande outro número do menu ou *0* para sair.'
  const ok = (...respostas) => ({ tratado: true, respostas })

  function menu(antes = '') {
    estado = 'menu'
    return ok(
      (antes ? antes + '\n\n' : '') +
        `⚙️ *Configurações do robô*\nResponda só com o número:\n\n` +
        `*1* - Informações do negócio (produtos, preços, horário…)\n` +
        `*2* - Adicionar conversas de exemplo\n` +
        `*3* - Horário de atendimento (agora: ${horarioTexto()})\n` +
        `*4* - Onde recebo os avisos (agora: ${destino()})\n` +
        `*5* - Pedidos e encomendas (agora: ${ajustes.pedidos ? 'ligado' : 'desligado'})\n` +
        `*6* - Ver o que eu sei sobre o negócio\n` +
        `*0* - Sair`,
    )
  }

  const COMO_EXPORTAR =
    `Como mandar:\n` +
    `1. Abra a conversa com o cliente no WhatsApp\n` +
    `2. Toque em ⋮ → *Mais* → *Exportar conversa* → *Sem mídia*\n` +
    `3. Escolha o WhatsApp e mande para este contato\n\n` +
    `A conversa está no WhatsApp do próprio negócio (o mesmo número deste robô)? Mande para o seu WhatsApp pessoal e depois *encaminhe* o arquivo para cá.`

  function passo2(antes) {
    estado = 'negocio'
    return ok(
      `${antes}\n\n*PASSO 2 de 2: informações do negócio*\n` +
        `Agora preciso saber o que você vende, preços, horário, pagamento e entrega.\n\n` +
        `O jeito mais fácil:\n` +
        `1. Abra uma IA grátis: Claude (claude.ai), ChatGPT (chatgpt.com) ou Gemini (gemini.google.com)\n` +
        `2. Copie a *próxima mensagem* e cole na IA\n` +
        `3. Mande junto fotos do cardápio, prints de preços e o link do seu Instagram ou site\n` +
        `4. Copie o texto que a IA devolver e cole aqui\n\n` +
        `Se preferir, mande o arquivo meu-negocio.txt.`,
      PROMPT_MEU_NEGOCIO,
    )
  }

  function concluir(antes) {
    configurando = false
    ajustes.configurado = true
    salvarAjustes(ajustes)
    estado = null
    return ok(
      `${antes}\n\n🎉 *Configuração concluída!* Já estou atendendo os seus clientes.\n\n` +
        `Dica: peça para alguém mandar uma mensagem para este número e veja como eu respondo.\n\n` +
        `Para mudar qualquer coisa depois (informações, conversas, horário, avisos no grupo da equipe, pedidos), é só me mandar *atualizar*.`,
    )
  }

  // A mensagem que o robô manda para o dono quando conecta pela primeira vez
  function boasVindas() {
    estado = 'conversas'
    configurando = true
    ultimaAtividade = agora()
    return [
      `👋 Olá! Eu sou o robô de atendimento de *${config.nomeNegocio}* e já estou conectado.\n\n` +
        `Antes de atender os seus clientes, vamos me configurar em 2 passos (uns 5 minutos).\n\n` +
        `*PASSO 1 de 2: conversas de exemplo*\n` +
        `Me mande conversas reais com clientes. Com elas eu aprendo o seu jeito de atender e as dúvidas mais comuns. ` +
        `Os nomes e telefones dos clientes são apagados antes de eu usar.\n\n` +
        `${COMO_EXPORTAR}\n\n` +
        `Pode mandar quantas quiser, uma por vez. Quando terminar, escreva *pronto*.\n` +
        `Não tem conversas para mandar? Escreva *pular*.`,
    ]
  }

  function guardarConversa(documento) {
    const nome = documento.nome || ''
    const mime = documento.mime || ''
    let conteudo = ''
    if (/\.zip$/i.test(nome) || /zip/i.test(mime)) {
      try {
        conteudo = textoDoZip(documento.dados)
      } catch {
        conteudo = ''
      }
    } else if (/\.txt$/i.test(nome) || /^text\//i.test(mime)) {
      conteudo = documento.dados.toString('utf8')
    } else {
      return { ok: false, texto: '❌ Esse arquivo não é uma conversa exportada. Na hora de exportar, escolha *Sem mídia*: o WhatsApp gera um arquivo .txt (ou .zip no iPhone).' }
    }
    const mensagens = lerExportacao(conteudo)
    if (mensagens.length < 2) {
      return { ok: false, texto: '❌ Não reconheci esse arquivo como uma conversa do WhatsApp. Exporte de novo pelo ⋮ → Mais → Exportar conversa → Sem mídia.' }
    }
    mkdirSync(pastaConversas, { recursive: true })
    writeFileSync(join(pastaConversas, `conversa-${agora()}.txt`), conteudo)
    const { totalConversas } = recarregar()
    return { ok: true, texto: `✅ Conversa recebida (${mensagens.length} mensagens). Agora tenho ${totalConversas} conversa${totalConversas === 1 ? '' : 's'} de exemplo.` }
  }

  function guardarNegocio(texto) {
    const limpo = texto.replace(/^```[a-z]*\s*$/gim, '').trim()
    if (existsSync(arquivoNegocio)) copyFileSync(arquivoNegocio, arquivoAnterior)
    writeFileSync(arquivoNegocio, limpo + '\n')
    recarregar()
    const linhas = limpo.split(/\r?\n/).filter((l) => l.trim()).length
    return `✅ Guardei as informações do negócio (${linhas} linhas) e já estou usando.\nMandou errado? Escreva *desfazer* para voltar ao texto anterior.`
  }

  function verTudo() {
    const negocio = textoNegocio()
    const { totalConversas } = recarregar()
    const aviso = !negocio ? '⚠️ Ainda não tenho as informações do negócio.\n\n' : ehExemplo(negocio) ? '⚠️ Ainda é o *texto de exemplo*! Escolha 1 no menu para mandar o seu.\n\n' : ''
    const trecho = negocio.length > 3000 ? negocio.slice(0, 3000) + '\n(…continua)' : negocio
    return (
      `📋 *O que eu sei hoje*\n\n${aviso}` +
      `Conversas de exemplo: ${totalConversas}\nHorário: ${horarioTexto()}\nAvisos vão para: ${destino()}\nPedidos e encomendas: ${ajustes.pedidos ? 'ligado' : 'desligado'}` +
      (trecho ? `\n\n*Informações do negócio:*\n${trecho}` : '')
    )
  }

  async function escolherNoMenu(t) {
    switch (t) {
      case '1':
        estado = 'negocio'
        return ok(
          `Mande o texto novo *completo* com as informações do negócio (ele substitui o anterior), ou o arquivo meu-negocio.txt.\n\n` +
            `Quer o pedido pronto para colar numa IA? Escreva *prompt*.\nPara voltar: *menu*.`,
        )
      case '2':
        estado = 'conversas'
        return ok(`Me mande as conversas exportadas, uma por vez.\n\n${COMO_EXPORTAR}\n\nQuando terminar, escreva *pronto*.`)
      case '3':
        estado = 'horario'
        return ok(`Em que horário eu devo responder os clientes? (agora: ${horarioTexto()})\n\nMande assim: *08:00-18:00*\nPara atender o dia todo, mande *24h*.\n\nFora do horário eu fico quieto e a mensagem de ausência do WhatsApp Business avisa o cliente.`)
      case '4': {
        try {
          opcoesGrupos = await listarGrupos()
        } catch {
          opcoesGrupos = []
        }
        estado = 'avisos'
        const lista = opcoesGrupos.map((g, i) => `*${i + 2}* - Grupo "${g.nome}"`).join('\n')
        return ok(
          `📣 Para onde eu mando os avisos (cliente pedindo atendimento e pedidos)?\n\n*1* - O seu WhatsApp pessoal\n${lista}` +
            `\n\nO grupo da equipe não está na lista? Adicione o número deste robô no grupo, mande *atualizar* e escolha *4* de novo.`,
        )
      }
      case '5': {
        ajustes.pedidos = !ajustes.pedidos
        salvarAjustes(ajustes)
        recarregar()
        const texto = ajustes.pedidos
          ? `✅ Pedidos e encomendas *LIGADO*.\nQuando um cliente quiser fazer um pedido, eu anoto produto, quantidade, nome, dia e horário e se é retirada ou entrega, confirmo com ele e mando o resumo para ${destino()}. Uma pessoa da equipe finaliza com o cliente.\n\nPara desligar, escolha *5* de novo.`
          : `Pedidos e encomendas *DESLIGADO*.\nQuando o cliente quiser fechar um pedido, eu chamo uma pessoa da equipe.`
        return ok(texto + rodape)
      }
      case '6':
        return ok(verTudo() + rodape)
      default:
        return menu('Não entendi 🙂')
    }
  }

  // documento (opcional): { nome, mime, dados: Buffer }
  async function receber({ texto = '', documento = null } = {}) {
    const t = limparComando(texto)
    const limite = configurando ? EXPIRA_CONFIGURACAO_MS : EXPIRA_MENU_MS
    if (estado && agora() - ultimaAtividade > limite) {
      estado = null
      configurando = false
    }
    ultimaAtividade = agora()

    if (['atualizar', 'menu', 'configuracoes', 'ajustes'].includes(t)) {
      configurando = false
      return menu()
    }
    if (t === 'configurar') return ok(...boasVindas())
    if (t === 'desfazer') {
      if (!existsSync(arquivoAnterior)) return ok('Não tenho um texto anterior para voltar.')
      copyFileSync(arquivoAnterior, arquivoNegocio)
      recarregar()
      return ok('↩️ Pronto, voltei para o texto anterior das informações do negócio.')
    }

    if (!estado) {
      // fora do menu, o dono conversa com o robô como um cliente (bom para testar).
      // Só arquivos de conversa são aproveitados direto.
      if (!documento) return { tratado: false, respostas: [] }
      const r = guardarConversa(documento)
      return ok(r.ok ? `${r.texto}\n\nPara as outras configurações, mande *atualizar*.` : `${r.texto}\n\nSe é o texto com as informações do negócio, mande *atualizar* e escolha *1*.`)
    }

    if (['sair', 'cancelar'].includes(t) || (t === '0' && estado !== 'avisos')) {
      estado = null
      configurando = false
      return ok('Saí das configurações. Quando precisar, é só me mandar *atualizar*. Sucesso!')
    }

    switch (estado) {
      case 'menu':
        if (documento) {
          const r = guardarConversa(documento)
          return ok(r.texto + rodape)
        }
        return escolherNoMenu(t)

      case 'conversas': {
        if (documento) {
          const r = guardarConversa(documento)
          return ok(r.ok ? `${r.texto}\nPode mandar outra, ou escreva *pronto*.` : r.texto)
        }
        if (['pronto', 'pular', 'terminei', 'acabei', 'ok', 'so isso'].includes(t)) {
          const { totalConversas } = recarregar()
          const resumo = totalConversas ? `✅ Passo 1 concluído: aprendi com ${totalConversas} conversa${totalConversas === 1 ? '' : 's'}.` : 'Tudo bem, seguimos sem conversas de exemplo (dá para mandar depois).'
          if (configurando) return passo2(resumo)
          return menu(resumo)
        }
        return ok('Estou esperando as conversas exportadas (arquivo .txt ou .zip). Quando terminar, escreva *pronto*.')
      }

      case 'negocio': {
        if (t === 'prompt') return ok('Copie a mensagem abaixo e cole na IA 👇', PROMPT_MEU_NEGOCIO)
        if (t === 'pular' && configurando) return concluir('Tudo bem! Sem as informações do negócio eu chamo uma pessoa para quase tudo. Mande *atualizar* e escolha *1* quando tiver o texto.')
        let conteudo = texto
        if (documento) {
          if (!/\.txt$/i.test(documento.nome || '') && !/^text\//i.test(documento.mime || '')) {
            return ok('Esse arquivo eu não consigo ler. Cole o texto aqui na conversa ou mande um arquivo .txt.')
          }
          conteudo = documento.dados.toString('utf8')
        }
        if ((conteudo || '').trim().length < TEXTO_MINIMO) {
          return ok('Esse texto ficou muito curto. Cole o texto *completo* que a IA te devolveu (ou mande o arquivo .txt).\nPara receber o pedido para a IA de novo, escreva *prompt*.')
        }
        if (ehExemplo(conteudo)) return ok('Esse ainda é o texto de exemplo 🙂 Mande o texto com as informações do *seu* negócio.')
        const r = guardarNegocio(conteudo)
        if (configurando) return concluir(r)
        return menu(r)
      }

      case 'horario': {
        const lido = lerHorario(t)
        if (lido === null) {
          return ok('Não entendi o horário. Mande assim: *08:00-18:00* (ou *24h* para o dia todo).')
        }
        ajustes.horario = lido
        config.horario = ajustes.horario
        salvarAjustes(ajustes)
        return menu(`✅ Horário de atendimento: ${horarioTexto()}.`)
      }

      case 'avisos': {
        const n = Number(t)
        if (n === 1) {
          ajustes.grupoAvisos = null
        } else if (Number.isInteger(n) && opcoesGrupos[n - 2]) {
          const g = opcoesGrupos[n - 2]
          ajustes.grupoAvisos = { jid: g.jid, nome: g.nome }
        } else {
          return ok('Responda só com o número de uma das opções da lista.')
        }
        salvarAjustes(ajustes)
        const r = menu(`✅ Pronto! Os avisos agora vão para ${destino()}.`)
        if (ajustes.grupoAvisos) {
          r.envios = [{ para: ajustes.grupoAvisos.jid, texto: `🤖 Olá, equipe! A partir de agora os avisos do robô de atendimento (cliente pedindo atendimento${ajustes.pedidos ? ' e pedidos' : ''}) chegam neste grupo.` }]
        }
        return r
      }
    }
    return { tratado: false, respostas: [] }
  }

  return {
    receber,
    boasVindas,
    get estado() {
      return estado
    },
  }
}
