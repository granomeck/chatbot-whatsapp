// Transforma as conversas exportadas do WhatsApp em exemplos limpos para a IA aprender,
// tirando telefones, e-mails e nomes dos clientes (para proteger os dados deles).

// Aceita o formato do Android  "21/10/2026 18:12 - Maria: oi"
// e o do iPhone                "[21/10/2026, 18:12:05] Maria: oi"
const LINHA = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?:-\s*)?([^:]{1,60}?):\s(.*)$/
const INICIO_DE_MENSAGEM = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/
const DESCARTAR = /m[íi]dia oculta|media omitted|mensagem (foi )?apagada|message deleted|arquivo anexado|attached|imagem oculta|figurinha omitida|sticker omitted|\.(opus|jpg|jpeg|png|webp|mp4|pdf) \(/i

export function anonimizar(texto) {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\(?\d[\d\s().-]{7,}\d/g, '[telefone]')
}

export function lerExportacao(conteudo) {
  const mensagens = []
  for (const bruta of conteudo.replace(/[‎‏‪-‮﻿]/g, '').split(/\r?\n/)) {
    const m = bruta.match(LINHA)
    if (m) {
      mensagens.push({ autor: m[1].trim(), texto: m[2].trim() })
    } else if (!INICIO_DE_MENSAGEM.test(bruta) && bruta.trim() && mensagens.length) {
      mensagens[mensagens.length - 1].texto += ' ' + bruta.trim() // mensagem com várias linhas
    }
    // linhas com data mas sem autor são avisos do sistema ("criptografia...") e ficam de fora
  }
  return mensagens.filter((m) => m.texto && !DESCARTAR.test(m.texto))
}

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Descobre quem é o dono do negócio: o nome configurado, ou quem aparece em mais conversas.
export function descobrirAtendente(conversas, nomeConfigurado = '') {
  if (nomeConfigurado) return normalizar(nomeConfigurado)
  const contagem = new Map()
  for (const msgs of conversas) {
    for (const autor of new Set(msgs.map((m) => normalizar(m.autor)))) {
      contagem.set(autor, (contagem.get(autor) || 0) + 1)
    }
  }
  let melhor = ''
  let max = 0
  for (const [autor, n] of contagem) if (n > max) [melhor, max] = [autor, n]
  return max > 1 ? melhor : ''
}

export function formatarConversa(mensagens, atendente) {
  const ehAtendente = (autor) => atendente && normalizar(autor).includes(atendente)
  // primeiros nomes dos clientes, para apagar quando aparecem no meio do texto ("Oi Maria")
  const nomesClientes = new Set()
  for (const m of mensagens) {
    if (ehAtendente(m.autor)) continue
    for (const parte of m.autor.split(/\s+/)) if (/^\p{L}{3,}$/u.test(parte)) nomesClientes.add(parte)
  }
  return mensagens
    .map((m) => {
      let texto = anonimizar(m.texto)
      for (const nome of nomesClientes) texto = texto.replace(new RegExp(`(?<!\\p{L})${nome}(?!\\p{L})`, 'giu'), 'cliente')
      return `${ehAtendente(m.autor) ? 'Atendente' : 'Cliente'}: ${texto}`
    })
    .join('\n')
}
