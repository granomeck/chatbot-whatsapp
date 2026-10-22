// Lê o arquivo .env (as configurações do robô) sem precisar de nenhum pacote extra.
import { readFileSync, existsSync } from 'node:fs'

export function carregarEnv(caminho = '.env') {
  if (!existsSync(caminho)) return false
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const l = linha.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i < 0) continue
    const chave = l.slice(0, i).trim()
    let valor = l.slice(i + 1).trim()
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1)
    }
    if (!(chave in process.env)) process.env[chave] = valor
  }
  return true
}

export const soDigitos = (texto = '') => String(texto).replace(/\D/g, '')

// Valores que ainda estão com o texto de exemplo contam como "não preenchido".
const preenchido = (v) => {
  const t = (v || '').trim()
  return t && !/^cole|^seu_|^sua_|aqui$/i.test(t) ? t : ''
}

export function lerConfig(env = process.env) {
  return {
    chaveGemini: preenchido(env.GEMINI_API_KEY),
    chaveReserva: preenchido(env.GEMINI_API_KEY_RESERVA),
    numeroRobo: soDigitos(preenchido(env.NUMERO_DO_ROBO)),
    modelo: preenchido(env.GEMINI_MODELO) || 'gemini-flash-lite-latest',
    nomeNegocio: preenchido(env.NOME_DO_NEGOCIO) || 'nossa loja',
    numeroDono: soDigitos(preenchido(env.SEU_WHATSAPP_PESSOAL)),
    meuNomeNasConversas: preenchido(env.SEU_NOME_NAS_CONVERSAS),
    horario: preenchido(env.HORARIO_ATENDIMENTO),
    pausaMinutos: Number(env.PAUSA_APOS_CHAMAR_HUMANO_MINUTOS) || 60,
    porta: Number(env.PORTA) || 3008,
  }
}
