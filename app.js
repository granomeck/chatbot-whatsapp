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
import { ligarConexaoPorCodigo } from './src/conexao.js'

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
console.log(`   Número do robô: ${config.numeroRobo || 'NÃO PREENCHIDO'}`)

// A conexão é sempre por CÓDIGO (sem QR Code): funciona igual no celular e no PC
if (!config.numeroRobo) {
  console.log('\n❌ Falta o número do robô.')
  console.log('   Abra o arquivo .env, preencha NUMERO_DO_ROBO= com o número do WhatsApp do robô')
  console.log('   (55 + DDD + número, só números) e rode de novo.')
  console.log('   No Termux: nano ~/chatbot-whatsapp/.env   e depois   bash ~/chatbot-whatsapp/atualizar.sh\n')
  setInterval(() => {}, 1 << 30) // fica parado esperando, sem reiniciar em sequência
  await new Promise(() => {})
}
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

// usePairingCode fica desligado de propósito: quem pede o código é o src/conexao.js, na hora certa
// clearAuthOnLogout: se o WhatsApp recusar a sessão salva, ela é apagada e um código novo é gerado
const provider = createProvider(BaileysProvider, { usePairingCode: false, clearAuthOnLogout: true })
ligarConexaoPorCodigo(provider, config.numeroRobo)
provider.on('ready', () => console.log('\n✅ WhatsApp conectado! O robô já está atendendo.\n'))

const { httpServer } = await createBot({
  flow: createFlow([atendimento]),
  provider,
  database: new JsonFileDB({ filename: 'db.json' }),
})
httpServer(config.porta)
console.log('\n📱 Aguarde: em alguns segundos aparece aqui o CÓDIGO para conectar o WhatsApp do robô.\n')
