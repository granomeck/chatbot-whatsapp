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
  assert.match(c.midia('1').respostas[0], /só consigo ler/)
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
