// Liga o cérebro do robô ao WhatsApp (BuilderBot + Baileys).
import './src/compat-android.js' // precisa ser o primeiro: deixa o BuilderBot rodar no Termux
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { JsonFileDB } from '@builderbot/database-json'
import { carregarEnv, lerConfig } from './src/config.js'
import { carregarConhecimento } from './src/conhecimento.js'
import { criarCerebro, tempoDigitando } from './src/cerebro.js'
import { criarIAGemini } from './src/ia-gemini.js'
import { criarIADemo } from './src/ia-demo.js'
import { tipoDoAnexo, baixarAnexo } from './src/midia.js'

if (!carregarEnv('.env')) {
  console.log('⚠️  Não achei o arquivo .env. Copie o .env.example com o nome .env e preencha (veja o LEIA-ME).')
}
// Se algum pacote de terceiros falhar sem tratar o erro, registra e segue ligado (em vez de cair)
process.on('unhandledRejection', (e) => console.log(`⚠️  Erro de um pacote interno (o robô continua ligado): ${e?.message || e}`))

const config = lerConfig()
const conhecimento = carregarConhecimento({ meuNomeNasConversas: config.meuNomeNasConversas })
const ia = config.chaveGemini
  ? criarIAGemini({
      chave: config.chaveGemini,
      chaveReserva: config.chaveReserva,
      modelo: config.modelo,
      aoUsarReserva: (e) => console.log(`↪️  Chave grátis falhou (${e.status || 'sem resposta'}): usei a chave de reserva.`),
    })
  : criarIADemo(conhecimento)
const cerebro = criarCerebro({ config, conhecimento, ia })

console.log(`\n🤖 Robô de "${config.nomeNegocio}"`)
console.log(config.chaveGemini ? `   IA: Gemini (${config.modelo})${config.chaveReserva ? ' + chave de reserva' : ''}` : '   IA: MODO DEMONSTRAÇÃO (falta a chave do Gemini no .env)')
console.log(`   Conexão: ${config.numeroRobo ? `código pelo número ${config.numeroRobo}` : 'QR Code'}`)
console.log(`   Conversas de exemplo carregadas: ${conhecimento.totalConversas}`)
console.log(`   Horário de atendimento: ${config.horario || '24 horas'}`)
if (!config.numeroDono) console.log('   ⚠️  SEU_WHATSAPP_PESSOAL vazio: ninguém vai ser avisado quando o cliente pedir atendimento.')

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function digitando(provider, jid, ms) {
  try {
    await provider.vendor?.sendPresenceUpdate('composing', jid)
    await esperar(ms)
    await provider.vendor?.sendPresenceUpdate('paused', jid)
  } catch {
    await esperar(ms) // se o "digitando" falhar, só espera
  }
}

const atendimento = addKeyword(EVENTS.WELCOME).addAction(async (ctx, { provider, flowDynamic }) => {
  const jid = ctx.key?.remoteJid || ''
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return // não responde grupos nem status

  const texto = (ctx.body || '').trim()
  let resultado
  if (texto.startsWith('_event_')) {
    // áudio ou foto: o Gemini ouve/vê e responde; o resto (vídeo, figurinha, documento) recebe um aviso
    const info = tipoDoAnexo(ctx)
    let anexo = null
    if (info) {
      try {
        anexo = await baixarAnexo(provider, ctx, info)
      } catch (e) {
        console.log(`⚠️  Não consegui baixar o ${info.tipo} de ${ctx.from}: ${e.message}`)
      }
    }
    resultado = anexo ? await cerebro.responder(ctx.from, ctx.name, anexo.legenda, anexo) : cerebro.midia(ctx.from)
  } else {
    resultado = await cerebro.responder(ctx.from, ctx.name, texto)
  }

  if (resultado.erro) console.log(`⚠️  ${ctx.from}: ${resultado.erro}`)
  if (resultado.ignorar) return

  for (const resposta of resultado.respostas) {
    await digitando(provider, jid, tempoDigitando(resposta))
    await flowDynamic(resposta)
  }

  if (resultado.chamarHumano && config.numeroDono) {
    try {
      await provider.sendMessage(config.numeroDono, resultado.aviso, {})
      console.log(`🔔 Avisei você: ${ctx.from} quer falar com uma pessoa.`)
    } catch (e) {
      console.log(`⚠️  Não consegui te avisar no WhatsApp pessoal: ${e.message}`)
    }
  }
})

const { httpServer } = await createBot({
  flow: createFlow([atendimento]),
  // Com NUMERO_DO_ROBO preenchido, conecta por código (serve quando o robô roda no mesmo celular do número).
  provider: createProvider(BaileysProvider, config.numeroRobo ? { usePairingCode: true, phoneNumber: config.numeroRobo } : {}),
  database: new JsonFileDB({ filename: 'db.json' }),
})
httpServer(config.porta)
console.log(
  config.numeroRobo
    ? '\n📱 Para conectar: vai aparecer aqui um CÓDIGO de 8 letras/números. No WhatsApp do robô: ⋮ → Dispositivos conectados → Conectar dispositivo → Conectar com número de telefone → digite o código (ele vence em cerca de 1 minuto).\n'
    : `\n📱 Para conectar: escaneie o QR Code que aparece aqui, ou abra http://localhost:${config.porta} no navegador deste aparelho.\n`,
)
