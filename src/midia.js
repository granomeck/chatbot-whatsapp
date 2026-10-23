// Áudios e fotos que chegam no WhatsApp: descobre o tipo e baixa para mandar ao Gemini.
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'

export const LIMITE_BYTES = 10 * 1024 * 1024 // 10 MB: acima disso pede para o cliente escrever

// Que tipo de anexo veio? { tipo, mime, legenda } ou null (vídeo, figurinha, documento…)
export function tipoDoAnexo(ctx) {
  const m = ctx?.message || {}
  if (m.audioMessage) {
    return { tipo: 'audio', mime: limparMime(m.audioMessage.mimetype, 'audio/ogg'), legenda: '' }
  }
  if (m.imageMessage) {
    return { tipo: 'imagem', mime: limparMime(m.imageMessage.mimetype, 'image/jpeg'), legenda: m.imageMessage.caption || '' }
  }
  return null
}

// "audio/ogg; codecs=opus" -> "audio/ogg"
export function limparMime(mime, padrao) {
  const t = String(mime || '').split(';')[0].trim().toLowerCase()
  return t || padrao
}

// Baixa o arquivo pelo BuilderBot, lê em base64 e apaga a cópia temporária
export async function baixarAnexo(provider, ctx, info) {
  const caminho = await provider.saveFile(ctx, { path: tmpdir() })
  try {
    const dados = await readFile(caminho)
    if (dados.length > LIMITE_BYTES) return null
    return { ...info, base64: dados.toString('base64') }
  } finally {
    await unlink(caminho).catch(() => {})
  }
}

export const LIMITE_DOCUMENTO = 20 * 1024 * 1024 // 20 MB: conversas exportadas podem ser grandes

// Documento (arquivo) que chegou: { nome, mime, legenda } ou null
export function documentoDoAnexo(ctx) {
  const m = ctx?.message || {}
  const d = m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage
  if (!d) return null
  return { nome: d.fileName || d.title || '', mime: limparMime(d.mimetype, ''), legenda: d.caption || '' }
}

// Baixa o documento e devolve os bytes (para o painel do dono guardar conversas e o meu-negocio.txt)
export async function baixarDocumento(provider, ctx, info) {
  const caminho = await provider.saveFile(ctx, { path: tmpdir() })
  try {
    const dados = await readFile(caminho)
    if (dados.length > LIMITE_DOCUMENTO) return null
    return { ...info, dados }
  } finally {
    await unlink(caminho).catch(() => {})
  }
}
