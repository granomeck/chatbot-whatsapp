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
import { tipoDoAnexo, baixarAnexo, documentoDoAnexo, baixarDocumento } from './src/midia.js'
import { ligarConexaoPorCodigo } from './src/conexao.js'
import { lerAjustes, salvarAjustes } from './src/ajustes.js'
import { criarPainelDono, mesmoNumero, limparComando } from './src/painel-dono.js'

if (!carregarEnv('.env')) {
  console.log('⚠️  Não achei o arquivo .env. Copie o .env.example com o nome .env e preencha (veja o LEIA-ME).')
}
// Se algum pacote de terceiros falhar sem tratar o erro, registra e segue ligado (em vez de cair)
process.on('unhandledRejection', (e) => console.log(`⚠️  Erro de um pacote interno (o robô continua ligado): ${e?.message || e}`))

const config = lerConfig()
// o que o dono mudou pelo WhatsApp (mandando "atualizar") vale mais que o .env
const ajustes = lerAjustes('.')
if (ajustes.horario !== null) config.horario = ajustes.horario
config.pedidos = ajustes.pedidos
let conhecimento = carregarConhecimento({ meuNomeNasConversas: config.meuNomeNasConversas })
const ia = config.chaveGemini
  ? criarIAGemini({
      chave: config.chaveGemini,
      chaveReserva: config.chaveReserva,
      modelo: config.modelo,
      aoUsarReserva: (e) => console.log(`↪️  Chave grátis falhou (${e.status || 'sem resposta'}): usei a chave de reserva.`),
    })
  : criarIADemo(conhecimento)
const cerebro = criarCerebro({ config, conhecimento, ia })

// relê o meu-negocio.txt e as conversas depois que o dono manda algo novo pelo WhatsApp
function recarregar() {
  config.pedidos = ajustes.pedidos
  conhecimento = carregarConhecimento({ meuNomeNasConversas: config.meuNomeNasConversas })
  cerebro.recarregar(conhecimento)
  console.log(`🔄 Informações atualizadas pelo dono: ${conhecimento.totalConversas} conversas de exemplo.`)
  return conhecimento
}

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
else console.log('   Configurações: do seu WhatsApp pessoal, mande "atualizar" para o robô.')
if (ajustes.grupoAvisos) console.log(`   Avisos vão para o grupo: ${ajustes.grupoAvisos.nome}`)
if (ajustes.pedidos) console.log('   Pedidos e encomendas: ligado')

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

let numeroDono = config.numeroDono // trocado pelo número exato do WhatsApp quando conecta
let provedor = null

const painel = criarPainelDono({
  pasta: '.',
  config,
  ajustes,
  salvarAjustes: (a) => salvarAjustes(a, '.'),
  recarregar,
  listarGrupos: async () => {
    const grupos = await provedor.vendor.groupFetchAllParticipating()
    return Object.values(grupos)
      .map((g) => ({ jid: g.id, nome: g.subject || 'Grupo sem nome' }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  },
})

// O WhatsApp às vezes mostra o número com o 9 a mais/a menos, ou com um código interno (@lid)
async function ehDono(ctx, provider) {
  if (!config.numeroDono) return false
  const k = ctx.key || {}
  const candidatos = [ctx.from, k.remoteJid, k.remoteJidAlt, k.senderPn].filter(Boolean).map(String)
  const confere = (n) => mesmoNumero(n, config.numeroDono) || mesmoNumero(n, numeroDono)
  if (candidatos.some((c) => !c.includes('@lid') && confere(c))) return true
  const lid = candidatos.find((c) => c.includes('@lid'))
  if (lid && typeof provider.getPNForLID === 'function') {
    try {
      const pn = await provider.getPNForLID(lid)
      if (pn && confere(pn)) return true
    } catch {}
  }
  return false
}

// avisos (cliente pedindo atendimento e pedidos) vão para o grupo escolhido ou para o dono
const destinoAvisos = () => ajustes.grupoAvisos?.jid || numeroDono

const atendimento = addKeyword(EVENTS.WELCOME).addAction(async (ctx, { provider, flowDynamic }) => {
  const jid = ctx.key?.remoteJid || ''
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return // não responde grupos nem status

  const texto = (ctx.body || '').trim()

  // Mensagens do dono: painel de configuração ("atualizar", conversas, informações do negócio)
  if (await ehDono(ctx, provider)) {
    const doc = documentoDoAnexo(ctx)
    let documento = null
    if (doc) {
      try {
        documento = await baixarDocumento(provider, ctx, doc)
      } catch (e) {
        console.log(`⚠️  Não consegui baixar o arquivo do dono: ${e.message}`)
      }
      if (!documento) return flowDynamic('❌ Não consegui baixar esse arquivo. Tente mandar de novo.')
    }
    const r = await painel.receber({ texto: doc ? doc.legenda : texto.startsWith('_event_') ? '' : texto, documento })
    if (r.tratado) {
      for (const resposta of r.respostas) await flowDynamic(resposta)
      for (const envio of r.envios || []) {
        await provider.sendMessage(envio.para, envio.texto, {}).catch((e) => console.log(`⚠️  Não consegui mandar no grupo: ${e.message}`))
      }
      return
    }
    // fora do menu, o dono é atendido como cliente (bom para testar o robô)
  } else if (limparComando(texto) === 'atualizar') {
    console.log(`ℹ️  ${ctx.from} mandou "atualizar", mas não é o SEU_WHATSAPP_PESSOAL do .env (${config.numeroDono || 'vazio'}).`)
  }
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

  if (resultado.chamarHumano && destinoAvisos()) {
    try {
      await provider.sendMessage(destinoAvisos(), resultado.aviso, {})
      console.log(resultado.pedido ? `🧾 Pedido de ${ctx.from} enviado para a equipe.` : `🔔 Avisei a equipe: ${ctx.from} quer falar com uma pessoa.`)
    } catch (e) {
      console.log(`⚠️  Não consegui mandar o aviso: ${e.message}`)
    }
  }
})

// usePairingCode fica desligado de propósito: quem pede o código é o src/conexao.js, na hora certa
// clearAuthOnLogout: se o WhatsApp recusar a sessão salva, ela é apagada e um código novo é gerado
const provider = createProvider(BaileysProvider, { usePairingCode: false, clearAuthOnLogout: true })
provedor = provider
ligarConexaoPorCodigo(provider, config.numeroRobo)

// número exato do dono no WhatsApp (resolve a diferença do 9 em números antigos)
async function resolverDono() {
  try {
    const [r] = await provider.vendor.onWhatsApp(`${config.numeroDono}@s.whatsapp.net`)
    if (r?.exists && r.jid) return String(r.jid).split('@')[0]
  } catch {}
  return config.numeroDono
}

provider.on('ready', async () => {
  console.log('\n✅ WhatsApp conectado! O robô já está atendendo.\n')
  if (!config.numeroDono) return
  numeroDono = await resolverDono()
  if (ajustes.boasVindasEnviada) return
  // primeira conexão: manda para o dono a mensagem de configuração
  try {
    await esperar(3000)
    for (const mensagem of painel.boasVindas()) {
      await provider.sendMessage(numeroDono, mensagem, {})
      await esperar(1000)
    }
    ajustes.boasVindasEnviada = true
    salvarAjustes(ajustes, '.')
    console.log('📩 Mandei a mensagem de configuração para o seu WhatsApp pessoal. Responda por lá!')
  } catch (e) {
    console.log(`⚠️  Não consegui mandar a mensagem de configuração: ${e.message}. Mande "configurar" do seu WhatsApp pessoal para o robô.`)
  }
})

const { httpServer } = await createBot({
  flow: createFlow([atendimento]),
  provider,
  database: new JsonFileDB({ filename: 'db.json' }),
})
httpServer(config.porta)
console.log('\n📱 Aguarde: em alguns segundos aparece aqui o CÓDIGO para conectar o WhatsApp do robô.\n')
