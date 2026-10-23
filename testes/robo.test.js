import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerConfig } from '../src/config.js'
import { lerExportacao, formatarConversa, descobrirAtendente, anonimizar } from '../src/limpar-conversas.js'
import { criarCerebro, pedeHumano, dentroDoHorario, tempoDigitando } from '../src/cerebro.js'
import { criarIADemo } from '../src/ia-demo.js'
import { readFileSync } from 'node:fs'

const configBase = { nomeNegocio: 'Loja Teste', pausaMinutos: 60, horario: '' }
const iaQueResponde = (texto) => ({ async gerar() { return texto } })

test('config ignora valores de exemplo do .env.example', () => {
  const c = lerConfig({ GEMINI_API_KEY: 'cole_sua_chave_aqui', SEU_WHATSAPP_PESSOAL: '+55 (11) 98888-7777' })
  assert.equal(c.chaveGemini, '')
  assert.equal(c.numeroDono, '5511988887777')
  assert.equal(c.modelo, 'gemini-flash-lite-latest')
})

test('lê exportação do Android e do iPhone, juntando mensagens de várias linhas', () => {
  const android = lerExportacao(readFileSync(new URL('../exemplos/conversa-exemplo.txt', import.meta.url), 'utf8'))
  assert.equal(android.length, 5) // aviso de criptografia e <Mídia oculta> ficam de fora
  assert.match(android[3].texto, /caso não me ache/)
  const iphone = lerExportacao('[21/10/2026, 18:12:05] ‎João Lima: Oi, aceita pix?\n[21/10/2026, 18:13:00] Loja: Aceita sim!')
  assert.deepEqual(iphone.map((m) => m.autor), ['João Lima', 'Loja'])
})

test('anonimiza telefone, e-mail e nome do cliente', () => {
  const msgs = lerExportacao(readFileSync(new URL('../exemplos/conversa-exemplo.txt', import.meta.url), 'utf8'))
  const texto = formatarConversa(msgs, 'loja exemplo')
  assert.doesNotMatch(texto, /4567|Maria|Souza/)
  assert.match(texto, /Atendente: Oi cliente, boa tarde!/)
  assert.match(texto, /Cliente: Entrega\. Meu número de casa é \[telefone\]/)
  assert.equal(anonimizar('me chama em joao@email.com'), 'me chama em [email]')
})

test('descobre o atendente: quem aparece em mais conversas', () => {
  const conversas = [
    [{ autor: 'Loja', texto: 'oi' }, { autor: 'Ana', texto: 'oi' }],
    [{ autor: 'Loja', texto: 'oi' }, { autor: 'Bruno', texto: 'oi' }],
  ]
  assert.equal(descobrirAtendente(conversas), 'loja')
})

test('reconhece pedido de humano', () => {
  for (const t of ['Quero falar com um atendente', 'tem alguém de verdade aí?', 'posso falar com você?', 'Quero falar com uma pessoa']) {
    assert.ok(pedeHumano(t), t)
  }
  assert.ok(!pedeHumano('quanto custa a camiseta?'))
})

test('horário de atendimento, inclusive virando a meia-noite', () => {
  const as = (h, m) => new Date(2026, 10, 27, h, m)
  assert.ok(dentroDoHorario('08:00-18:00', as(9, 0)))
  assert.ok(!dentroDoHorario('08:00-18:00', as(18, 0)))
  assert.ok(dentroDoHorario('18:00-02:00', as(1, 30)))
  assert.ok(dentroDoHorario('', as(3, 0)))
})

test('pedido de humano: responde, gera aviso e fica em silêncio com aquele cliente', async () => {
  let agora = 0
  const cerebro = criarCerebro({ config: configBase, conhecimento: {}, ia: iaQueResponde('oi'), agora: () => agora })
  const r = await cerebro.responder('5511911112222', 'Ana', 'quero falar com um atendente')
  assert.ok(r.chamarHumano)
  assert.match(r.aviso, /wa\.me\/5511911112222/)
  assert.equal((await cerebro.responder('5511911112222', 'Ana', 'oi?')).motivo, 'humano_atendendo')
  assert.deepEqual((await cerebro.responder('5511933334444', 'Bia', 'oi')).respostas, ['oi']) // outros clientes seguem normais
  agora += 61 * 60 * 1000
  assert.deepEqual((await cerebro.responder('5511911112222', 'Ana', 'oi')).respostas, ['oi']) // pausa acabou
})

test('IA pede humano com o marcador, que some da resposta', async () => {
  const cerebro = criarCerebro({ config: configBase, conhecimento: {}, ia: iaQueResponde('Vou chamar alguém da equipe! [CHAMAR_HUMANO]') })
  const r = await cerebro.responder('1', 'X', 'quero fechar o pedido')
  assert.deepEqual(r.respostas, ['Vou chamar alguém da equipe!'])
  assert.ok(r.chamarHumano)
})

test('limite da IA (429) não chama humano; outros erros chamam', async () => {
  const erroCom = (status) => ({ async gerar() { const e = new Error('x'); e.status = status; throw e } })
  const limite = await criarCerebro({ config: configBase, conhecimento: {}, ia: erroCom(429) }).responder('1', 'X', 'oi')
  assert.ok(!limite.chamarHumano)
  assert.match(limite.respostas[0], /1 minutinho/)
  const outro = await criarCerebro({ config: configBase, conhecimento: {}, ia: erroCom(500) }).responder('1', 'X', 'oi')
  assert.ok(outro.chamarHumano)
})

test('lembra a conversa e manda parágrafos em balões separados', async () => {
  let recebido
  const ia = { async gerar({ historico }) { recebido = historico.map((m) => m.texto); return 'Temos sim!\n\nQual tamanho?' } }
  const cerebro = criarCerebro({ config: configBase, conhecimento: {}, ia })
  await cerebro.responder('1', 'X', 'tem vestido?')
  const r = await cerebro.responder('1', 'X', 'e no azul?')
  assert.deepEqual(recebido, ['tem vestido?', 'Temos sim!\n\nQual tamanho?', 'e no azul?'])
  assert.deepEqual(r.respostas, ['Temos sim!', 'Qual tamanho?'])
})

test('fora do horário o robô fica quieto; mídia é avisada uma vez', async () => {
  const fora = criarCerebro({ config: { ...configBase, horario: '08:00-18:00' }, conhecimento: {}, ia: iaQueResponde('oi'), agora: () => new Date(2026, 10, 27, 22, 0).getTime() })
  assert.equal((await fora.responder('1', 'X', 'oi')).motivo, 'fora_do_horario')
  const c = criarCerebro({ config: configBase, conhecimento: {}, ia: iaQueResponde('oi') })
  assert.match(c.midia('1').respostas[0], /não consigo abrir/)
  assert.ok(c.midia('1').ignorar)
})

test('modo demonstração responde com o meu-negocio.txt', async () => {
  const ia = criarIADemo({ negocio: readFileSync(new URL('../meu-negocio.txt', import.meta.url), 'utf8') })
  const r = await ia.gerar({ historico: [{ papel: 'cliente', texto: 'Qual o horário?' }] })
  assert.match(r, /segunda a sexta/)
})

test('tempo do digitando fica entre 1,5 e 5 segundos', () => {
  assert.equal(tempoDigitando('oi'), 1500)
  assert.equal(tempoDigitando('x'.repeat(500)), 5000)
})

test('chave de reserva: usada só quando a grátis bate o limite', async () => {
  const { criarIAGemini } = await import('../src/ia-gemini.js')
  const original = globalThis.fetch
  const chavesUsadas = []
  globalThis.fetch = async (url, op) => {
    const chave = op.headers['x-goog-api-key']
    chavesUsadas.push(chave)
    if (chave === 'GRATIS') return { ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' }
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'resposta paga' }] } }] }) }
  }
  try {
    let avisou = false
    const ia = criarIAGemini({ chave: 'GRATIS', chaveReserva: 'PAGA', modelo: 'x', aoUsarReserva: () => (avisou = true) })
    assert.equal(await ia.gerar({ instrucoes: '', historico: [{ papel: 'cliente', texto: 'oi' }] }), 'resposta paga')
    assert.deepEqual(chavesUsadas, ['GRATIS', 'PAGA'])
    assert.ok(avisou)
    const semReserva = criarIAGemini({ chave: 'GRATIS', modelo: 'x' })
    await assert.rejects(semReserva.gerar({ instrucoes: '', historico: [{ papel: 'cliente', texto: 'oi' }] }), (e) => e.status === 429)
  } finally {
    globalThis.fetch = original
  }
})

test('config lê número do robô e chave de reserva', () => {
  const c = lerConfig({ NUMERO_DO_ROBO: '+55 (15) 99999-0000', GEMINI_API_KEY_RESERVA: 'AIzaReserva' })
  assert.equal(c.numeroRobo, '5515999990000')
  assert.equal(c.chaveReserva, 'AIzaReserva')
  assert.equal(lerConfig({}).numeroRobo, '')
})

test('áudio e imagem: identifica o tipo e limpa o mime', async () => {
  const { tipoDoAnexo, limparMime } = await import('../src/midia.js')
  assert.deepEqual(tipoDoAnexo({ message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus' } } }), { tipo: 'audio', mime: 'audio/ogg', legenda: '' })
  assert.deepEqual(tipoDoAnexo({ message: { imageMessage: { mimetype: 'image/jpeg', caption: 'tem no M?' } } }), { tipo: 'imagem', mime: 'image/jpeg', legenda: 'tem no M?' })
  assert.equal(tipoDoAnexo({ message: { stickerMessage: {} } }), null)
  assert.equal(limparMime('', 'audio/ogg'), 'audio/ogg')
})

test('baixa o anexo em base64 e apaga o arquivo temporário', async () => {
  const { baixarAnexo, LIMITE_BYTES } = await import('../src/midia.js')
  const { writeFile } = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  let caminho
  const provider = { async saveFile(ctx, { path }) { caminho = join(path, 'teste-audio.ogg'); await writeFile(caminho, Buffer.from('ABC')); return caminho } }
  const a = await baixarAnexo(provider, {}, { tipo: 'audio', mime: 'audio/ogg', legenda: '' })
  assert.equal(a.base64, Buffer.from('ABC').toString('base64'))
  assert.ok(!existsSync(caminho))
  const grande = { async saveFile(ctx, { path }) { caminho = join(path, 'grande.jpg'); await writeFile(caminho, Buffer.alloc(LIMITE_BYTES + 1)); return caminho } }
  assert.equal(await baixarAnexo(grande, {}, { tipo: 'imagem', mime: 'image/jpeg', legenda: '' }), null)
  assert.ok(!existsSync(caminho) && tmpdir())
})

test('cérebro manda o anexo para a IA e guarda só um resumo na memória', async () => {
  let recebido
  const ia = { async gerar(p) { recebido = p; return 'Entendi! Temos sim no M.' } }
  const c = criarCerebro({ config: configBase, conhecimento: {}, ia })
  const anexo = { tipo: 'audio', mime: 'audio/ogg', base64: 'QUJD', legenda: '' }
  const r = await c.responder('1', 'Ana', '', anexo)
  assert.deepEqual(r.respostas, ['Entendi! Temos sim no M.'])
  assert.equal(recebido.anexo, anexo)
  assert.equal(recebido.historico[0].texto, '[áudio enviado pelo cliente]')
  const foto = await c.responder('2', 'Bia', 'quero falar com um atendente', { tipo: 'imagem', mime: 'image/jpeg', base64: 'x', legenda: 'quero falar com um atendente' })
  assert.ok(foto.chamarHumano) // legenda pedindo humano chama humano
})

test('Gemini recebe o áudio junto da última mensagem do cliente', async () => {
  const { criarIAGemini, montarConteudo } = await import('../src/ia-gemini.js')
  const hist = [{ papel: 'cliente', texto: 'oi' }, { papel: 'robo', texto: 'olá' }, { papel: 'cliente', texto: '[áudio enviado pelo cliente]' }]
  const anexo = { mime: 'audio/ogg', base64: 'QUJD' }
  const c = montarConteudo(hist, anexo)
  assert.deepEqual(c[2].parts[0], { inlineData: { mimeType: 'audio/ogg', data: 'QUJD' } })
  assert.equal(c[0].parts.length, 1)
  const original = globalThis.fetch; let corpo
  globalThis.fetch = async (u, op) => { corpo = JSON.parse(op.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) } }
  try { await criarIAGemini({ chave: 'k', modelo: 'm' }).gerar({ instrucoes: 'i', historico: hist, anexo }) } finally { globalThis.fetch = original }
  assert.equal(corpo.contents[2].parts[0].inlineData.data, 'QUJD')
})

test('vídeo/figurinha continuam recebendo o aviso', () => {
  const c = criarCerebro({ config: configBase, conhecimento: {}, ia: iaQueResponde('x') })
  assert.match(c.midia('9').respostas[0], /texto, áudio ou foto/)
})

test('Android: troca sharp e ffmpeg por versões compatíveis (e não mexe em outros sistemas)', async () => {
  const { prepararAndroid } = await import('../src/preparar-android.js')
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { createRequire } = await import('node:module')
  const pasta = mkdtempSync(join(tmpdir(), 'robo-'))
  mkdirSync(join(pasta, 'node_modules', 'sharp'), { recursive: true })
  writeFileSync(join(pasta, 'node_modules', 'sharp', 'original.txt'), 'sharp de verdade')
  assert.deepEqual(prepararAndroid(pasta, 'win32'), [])
  assert.equal(readFileSync(join(pasta, 'node_modules', 'sharp', 'original.txt'), 'utf8'), 'sharp de verdade')
  assert.deepEqual(prepararAndroid(pasta, 'android'), ['sharp', '@ffmpeg-installer/ffmpeg'])
  const exigir = createRequire(join(pasta, 'x.js'))
  const sharp = exigir('sharp')
  let ok = false
  sharp(Buffer.from('qr')).extend({ top: 15 }).toFile('x.png', (e) => { ok = e === null })
  assert.ok(ok)
  assert.equal(exigir('@ffmpeg-installer/ffmpeg').path, 'ffmpeg')
  const { default: sharpEsm } = await import(join(pasta, 'node_modules', 'sharp', 'index.mjs'))
  assert.equal(typeof sharpEsm, 'function')
})

test('conexão por código: pede o código só quando o WhatsApp está pronto, um por conexão', async () => {
  const { ligarConexaoPorCodigo } = await import('../src/conexao.js')
  const { EventEmitter } = await import('node:events')
  const provider = new EventEmitter()
  const pedidos = []; const linhas = []; const repassados = []
  provider.on('require_action', (d) => repassados.push(d))
  const novaConexao = () => ({ requestPairingCode: async (n) => { pedidos.push(n); return 'ABCD1234' } })
  ligarConexaoPorCodigo(provider, '5515997176759', (l) => linhas.push(l))
  provider.vendor = novaConexao()
  provider.emit('require_action', { payload: { qr: 'qr-1' } })
  provider.emit('require_action', { payload: { qr: 'qr-2' } }) // mesmo socket: não pede de novo
  await new Promise((r) => setTimeout(r, 5))
  assert.deepEqual(pedidos, ['5515997176759'])
  assert.ok(linhas.some((l) => l.includes('ABCD-1234')))
  assert.equal(repassados.length, 0) // aviso de QR não aparece
  provider.vendor = novaConexao() // reconectou: pede um código novo
  provider.emit('require_action', { payload: { qr: 'qr-3' } })
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(pedidos.length, 2)
  provider.emit('require_action', { payload: { code: 'XYZ' } }) // outros avisos passam normalmente
  assert.equal(repassados.length, 1)
})

test('conexão por código: se o WhatsApp recusar o pedido, tenta de novo no próximo aviso', async () => {
  const { ligarConexaoPorCodigo } = await import('../src/conexao.js')
  const { EventEmitter } = await import('node:events')
  const provider = new EventEmitter(); let tentativas = 0
  provider.vendor = { requestPairingCode: async () => { tentativas++; if (tentativas === 1) throw new Error('Connection Closed'); return 'AAAA1111' } }
  const linhas = []
  ligarConexaoPorCodigo(provider, '55159', (l) => linhas.push(l))
  provider.emit('require_action', { payload: { qr: '1' } })
  await new Promise((r) => setTimeout(r, 5))
  provider.emit('require_action', { payload: { qr: '2' } })
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(tentativas, 2)
  assert.ok(linhas.some((l) => l.includes('AAAA-1111')))
})

// ---------------- Painel do dono pelo WhatsApp ----------------
import { mkdtempSync, writeFileSync as escrever, readFileSync as ler, existsSync as existe, readdirSync as listar } from 'node:fs'
import { tmpdir as pastaTemp } from 'node:os'
import { join as juntar } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { criarPainelDono, mesmoNumero, lerHorario, PROMPT_MEU_NEGOCIO } from '../src/painel-dono.js'
import { lerAjustes, salvarAjustes, AJUSTES_PADRAO } from '../src/ajustes.js'
import { textoDoZip } from '../src/zip.js'
import { documentoDoAnexo } from '../src/midia.js'
import { carregarConhecimento } from '../src/conhecimento.js'

const CONVERSA = '21/10/2026 18:12 - Maria Souza: Oi, tem bolo de cenoura?\n21/10/2026 18:13 - Padaria: Tem sim! R$ 25,00\n21/10/2026 18:14 - Maria Souza: Quero um para amanhã'
const NEGOCIO = 'SOBRE O NEGÓCIO\nPadaria Teste, Rua A, 10, Centro. Fazemos entrega.\n\nPRODUTOS E PREÇOS\nBolo de cenoura: R$ 25,00\nPão francês: R$ 0,90 a unidade'

function montarPainel({ grupos = [] } = {}) {
  const pasta = mkdtempSync(juntar(pastaTemp(), 'painel-'))
  escrever(juntar(pasta, 'meu-negocio.txt'), '=== APAGUE ESTE EXEMPLO E ESCREVA AS INFORMAÇÕES DO SEU NEGÓCIO ===\nexemplo')
  const config = { nomeNegocio: 'Padaria Teste', horario: '' }
  const ajustes = lerAjustes(pasta)
  let recargas = 0
  const painel = criarPainelDono({
    pasta,
    config,
    ajustes,
    salvarAjustes: (a) => salvarAjustes(a, pasta),
    recarregar: () => {
      recargas++
      return carregarConhecimento({ pasta })
    },
    listarGrupos: async () => grupos,
  })
  return { pasta, config, ajustes, painel, recargas: () => recargas }
}
const doc = (nome, conteudo, mime = 'text/plain') => ({ nome, mime, dados: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo) })

test('reconhece o número do dono com e sem o 9', () => {
  assert.ok(mesmoNumero('5515997176759', '551597176759@s.whatsapp.net'))
  assert.ok(mesmoNumero('+55 (15) 99717-6759', '5515997176759'))
  assert.ok(!mesmoNumero('5515997176759', '5515997176758'))
  assert.ok(!mesmoNumero('', '5515997176759'))
})

test('entende o horário de vários jeitos', () => {
  assert.equal(lerHorario('8h às 18h'), '08:00-18:00')
  assert.equal(lerHorario('07:30-12:00'), '07:30-12:00')
  assert.equal(lerHorario('24h'), '')
  assert.equal(lerHorario('quando der'), null)
})

test('configuração inicial: conversas, prompt para a IA e informações do negócio', async () => {
  const { pasta, ajustes, painel } = montarPainel()
  const [boasVindas] = painel.boasVindas()
  assert.match(boasVindas, /PASSO 1 de 2/)
  assert.match(boasVindas, /Exportar conversa/)

  let r = await painel.receber({ documento: doc('Conversa do WhatsApp com Maria.txt', CONVERSA) })
  assert.match(r.respostas[0], /Conversa recebida \(3 mensagens\)\. Agora tenho 1 conversa de exemplo/)
  assert.equal(listar(juntar(pasta, 'conversas')).length, 1)

  r = await painel.receber({ documento: doc('foto.jpg', 'xx', 'image/jpeg') })
  assert.match(r.respostas[0], /não é uma conversa/)

  r = await painel.receber({ texto: '*Pronto!*' })
  assert.match(r.respostas[0], /PASSO 2 de 2/)
  assert.equal(r.respostas[1], PROMPT_MEU_NEGOCIO) // o prompt vai numa mensagem separada, fácil de copiar

  r = await painel.receber({ texto: 'padaria de bairro' })
  assert.match(r.respostas[0], /muito curto/)

  r = await painel.receber({ texto: NEGOCIO })
  assert.match(r.respostas[0], /Guardei as informações do negócio/)
  assert.match(r.respostas[0], /Configuração concluída/)
  assert.match(r.respostas[0], /atualizar/)
  assert.match(ler(juntar(pasta, 'meu-negocio.txt'), 'utf8'), /Bolo de cenoura: R\$ 25,00/)
  assert.equal(ajustes.configurado, true)
  assert.equal(lerAjustes(pasta).configurado, true) // ficou salvo no ajustes.json

  // depois de configurado, mensagens comuns do dono vão para o atendimento normal (para ele testar)
  r = await painel.receber({ texto: 'oi, tem pão?' })
  assert.equal(r.tratado, false)
})

test('desfazer volta o texto anterior do negócio', async () => {
  const { pasta, painel } = montarPainel()
  await painel.receber({ texto: 'atualizar' })
  await painel.receber({ texto: '1' })
  await painel.receber({ texto: NEGOCIO })
  const r = await painel.receber({ texto: 'desfazer' })
  assert.match(r.respostas[0], /voltei para o texto anterior/)
  assert.match(ler(juntar(pasta, 'meu-negocio.txt'), 'utf8'), /APAGUE ESTE EXEMPLO/)
})

test('menu atualizar: horário, pedidos e avisos num grupo da equipe', async () => {
  const grupos = [{ jid: '1203630@g.us', nome: 'Grupo Padaria' }]
  const { pasta, config, ajustes, painel } = montarPainel({ grupos })
  let r = await painel.receber({ texto: 'Atualizar' })
  assert.match(r.respostas[0], /Configurações do robô/)

  await painel.receber({ texto: '3' })
  r = await painel.receber({ texto: '6h as 19h' })
  assert.match(r.respostas[0], /06:00-19:00/)
  assert.equal(config.horario, '06:00-19:00')

  r = await painel.receber({ texto: '5' })
  assert.match(r.respostas[0], /LIGADO/)
  assert.equal(ajustes.pedidos, true)

  r = await painel.receber({ texto: '4' })
  assert.match(r.respostas[0], /\*2\* - Grupo "Grupo Padaria"/)
  r = await painel.receber({ texto: '2' })
  assert.match(r.respostas[0], /avisos agora vão para o grupo "Grupo Padaria"/)
  assert.equal(r.envios[0].para, '1203630@g.us') // o robô avisa no grupo que ele passou a receber
  assert.deepEqual(lerAjustes(pasta).grupoAvisos, { jid: '1203630@g.us', nome: 'Grupo Padaria' })

  r = await painel.receber({ texto: '6' })
  assert.match(r.respostas[0], /Ainda é o \*texto de exemplo\*/)

  r = await painel.receber({ texto: '0' })
  assert.match(r.respostas[0], /Saí das configurações/)
  r = await painel.receber({ texto: '1' })
  assert.equal(r.tratado, false) // fora do menu, "1" é uma mensagem comum
})

test('menu fecha sozinho depois de 30 minutos parado', async () => {
  let relogio = 0
  const pasta = mkdtempSync(juntar(pastaTemp(), 'painel-'))
  const painel = criarPainelDono({ pasta, config: { nomeNegocio: 'X', horario: '' }, ajustes: { ...AJUSTES_PADRAO }, agora: () => relogio })
  await painel.receber({ texto: 'atualizar' })
  relogio += 31 * 60 * 1000
  const r = await painel.receber({ texto: '1' })
  assert.equal(r.tratado, false)
})

// monta um .zip de verdade (compactado) só com JavaScript, para o teste rodar em qualquer aparelho
function montarZip(nome, texto) {
  const nomeB = Buffer.from(nome)
  const dados = deflateRawSync(Buffer.from(texto))
  const tam = Buffer.byteLength(texto)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8)
  local.writeUInt32LE(dados.length, 18); local.writeUInt32LE(tam, 22); local.writeUInt16LE(nomeB.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10)
  central.writeUInt32LE(dados.length, 20); central.writeUInt32LE(tam, 24); central.writeUInt16LE(nomeB.length, 28); central.writeUInt32LE(0, 42)
  const inicioCentral = local.length + nomeB.length + dados.length
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(1, 8); fim.writeUInt16LE(1, 10)
  fim.writeUInt32LE(central.length + nomeB.length, 12); fim.writeUInt32LE(inicioCentral, 16)
  return Buffer.concat([local, nomeB, dados, central, nomeB, fim])
}

test('conversa exportada pelo iPhone (.zip) é aceita', async () => {
  const zip = montarZip('_chat.txt', '[21/10/2026, 18:12:05] João Lima: Oi, aceita pix?\n[21/10/2026, 18:13:00] Padaria: Aceita sim!')
  assert.match(textoDoZip(zip), /aceita pix/)
  const { painel } = montarPainel()
  const r = await painel.receber({ documento: doc('Conversa do WhatsApp com João.zip', zip, 'application/zip') })
  assert.match(r.respostas[0], /Conversa recebida \(2 mensagens\)/)
})

test('lê nome e tipo do documento que chegou no WhatsApp', () => {
  const info = documentoDoAnexo({ message: { documentWithCaptionMessage: { message: { documentMessage: { fileName: 'meu-negocio.txt', mimetype: 'text/plain; charset=utf-8', caption: '' } } } } })
  assert.deepEqual(info, { nome: 'meu-negocio.txt', mime: 'text/plain', legenda: '' })
  assert.equal(documentoDoAnexo({ message: { conversation: 'oi' } }), null)
})

test('pedidos ligados: o robô anota, tira o marcador e avisa a equipe', async () => {
  const config = { ...configBase, pedidos: true }
  const ia = iaQueResponde('Anotado, Ana! A equipe já vai confirmar seu pedido. [PEDIDO: 2 bolos de cenoura, sábado 10h, retirada, Ana]')
  const cerebro = criarCerebro({ config, conhecimento: { negocio: 'Bolo: R$ 25' }, ia })
  assert.match(cerebro.instrucoes, /\[PEDIDO:/)
  const r = await cerebro.responder('5511988887777', 'Ana', 'pode confirmar')
  assert.deepEqual(r.respostas, ['Anotado, Ana! A equipe já vai confirmar seu pedido.'])
  assert.equal(r.pedido, '2 bolos de cenoura, sábado 10h, retirada, Ana')
  assert.match(r.aviso, /Novo pedido/)
  assert.ok((await cerebro.responder('5511988887777', 'Ana', 'oi')).ignorar) // equipe finaliza
})

test('pedidos desligados: instrução antiga e recarregar troca as informações sem reiniciar', async () => {
  const config = { ...configBase, pedidos: false }
  const cerebro = criarCerebro({ config, conhecimento: { negocio: 'Pão: R$ 1' }, ia: iaQueResponde('ok') })
  assert.doesNotMatch(cerebro.instrucoes, /\[PEDIDO:/)
  assert.match(cerebro.instrucoes, /quiser fechar pedido/)
  config.pedidos = true
  cerebro.recarregar({ negocio: 'Pão: R$ 2' })
  assert.match(cerebro.instrucoes, /Pão: R\$ 2/)
  assert.match(cerebro.instrucoes, /\[PEDIDO:/)
})
