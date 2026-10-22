// Junta o texto do negócio (meu-negocio.txt) com as conversas exportadas (pasta conversas/).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { lerExportacao, descobrirAtendente, formatarConversa } from './limpar-conversas.js'

const LIMITE_EXEMPLOS = 15000 // caracteres: suficiente para aprender o tom sem gastar demais

export function carregarConhecimento({ pasta = '.', meuNomeNasConversas = '' } = {}) {
  const arquivoNegocio = join(pasta, 'meu-negocio.txt')
  const negocio = existsSync(arquivoNegocio) ? readFileSync(arquivoNegocio, 'utf8').trim() : ''

  const pastaConversas = join(pasta, 'conversas')
  const arquivos = existsSync(pastaConversas)
    ? readdirSync(pastaConversas).filter((a) => a.toLowerCase().endsWith('.txt'))
    : []
  const conversas = arquivos.map((a) => lerExportacao(readFileSync(join(pastaConversas, a), 'utf8')))
  const atendente = descobrirAtendente(conversas, meuNomeNasConversas)

  let exemplos = ''
  for (const msgs of conversas) {
    const bloco = formatarConversa(msgs, atendente)
    if (!bloco) continue
    if (exemplos.length + bloco.length > LIMITE_EXEMPLOS) break
    exemplos += (exemplos ? '\n---\n' : '') + bloco
  }

  return { negocio, exemplos, totalConversas: arquivos.length, atendenteIdentificado: Boolean(atendente) }
}
