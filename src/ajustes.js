// Ajustes que o dono muda pelo WhatsApp (mandando "atualizar" para o robô).
// Ficam no arquivo ajustes.json, que não vai para o GitHub. O que estiver aqui vale mais que o .env.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const AJUSTES_PADRAO = {
  boasVindasEnviada: false, // a mensagem de configuração já foi mandada para o dono?
  configurado: false, // o dono terminou os 2 passos da configuração?
  horario: null, // null = usa o HORARIO_ATENDIMENTO do .env; '' = 24 horas
  grupoAvisos: null, // { jid, nome } do grupo que recebe os avisos; null = WhatsApp pessoal do dono
  pedidos: false, // o robô anota pedidos/encomendas e manda o resumo para a equipe?
}

export function lerAjustes(pasta = '.') {
  const arquivo = join(pasta, 'ajustes.json')
  if (!existsSync(arquivo)) return { ...AJUSTES_PADRAO }
  try {
    return { ...AJUSTES_PADRAO, ...JSON.parse(readFileSync(arquivo, 'utf8')) }
  } catch {
    return { ...AJUSTES_PADRAO } // arquivo estragado: começa do padrão em vez de travar o robô
  }
}

export function salvarAjustes(ajustes, pasta = '.') {
  writeFileSync(join(pasta, 'ajustes.json'), JSON.stringify(ajustes, null, 2) + '\n')
}
