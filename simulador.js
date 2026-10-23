// Converse com o robô aqui no terminal, sem WhatsApp. Ótimo para testar o meu-negocio.txt.
// Rode:  npm run simular
import { createInterface } from 'node:readline'
import { carregarEnv, lerConfig } from './src/config.js'
import { carregarConhecimento } from './src/conhecimento.js'
import { criarCerebro } from './src/cerebro.js'
import { criarIAGemini } from './src/ia-gemini.js'
import { criarIADemo } from './src/ia-demo.js'
import { criarPainelDono } from './src/painel-dono.js'
import { lerAjustes, salvarAjustes } from './src/ajustes.js'

carregarEnv('.env')
const ajustes = lerAjustes('.')
const config = { ...lerConfig(), horario: '', pedidos: ajustes.pedidos } // no simulador o horário não bloqueia
const conhecimento = carregarConhecimento({ meuNomeNasConversas: config.meuNomeNasConversas })
const ia = config.chaveGemini ? criarIAGemini({ chave: config.chaveGemini, modelo: config.modelo }) : criarIADemo(conhecimento)
const cerebro = criarCerebro({ config, conhecimento, ia })
const painel = criarPainelDono({
  config,
  ajustes,
  salvarAjustes: (a) => salvarAjustes(a, '.'),
  recarregar: () => {
    config.pedidos = ajustes.pedidos
    const novo = carregarConhecimento({ meuNomeNasConversas: config.meuNomeNasConversas })
    cerebro.recarregar(novo)
    return novo
  },
})

console.log(`\nSimulador do robô de "${config.nomeNegocio}" — ${config.chaveGemini ? 'Gemini ligado' : 'MODO DEMONSTRAÇÃO (sem chave)'}`)
console.log('Escreva como se fosse um cliente. Para sair, digite: sair')
console.log('Para falar como DONO (painel de configuração), comece com  dono:   exemplo:  dono: atualizar\n')

const terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: 'Cliente: ' })
const digitadoPorPessoa = process.stdin.isTTY
terminal.prompt()
for await (const linha of terminal) {
  const texto = linha.trim()
  if (!digitadoPorPessoa) console.log(texto) // mostra a fala quando vem de um arquivo
  if (/^sair$/i.test(texto)) break
  if (!texto) { terminal.prompt(); continue }
  if (/^dono:/i.test(texto)) {
    const r = await painel.receber({ texto: texto.replace(/^dono:\s*/i, '') })
    for (const resposta of r.tratado ? r.respostas : ['(fora do menu: mande  dono: atualizar)']) console.log(`Robô → dono:\n   ${resposta.replaceAll('\n', '\n   ')}\n`)
    terminal.prompt()
    continue
  }
  const r = await cerebro.responder('5511999999999', 'Cliente Teste', texto)
  if (r.ignorar) console.log(`   (robô em silêncio: ${r.motivo === 'humano_atendendo' ? 'uma pessoa está atendendo' : r.motivo})`)
  for (const resposta of r.respostas || []) console.log(`Robô:    ${resposta}`)
  if (r.chamarHumano) console.log(`\n   >>> Aviso que iria para o seu WhatsApp pessoal:\n   ${r.aviso.replaceAll('\n', '\n   ')}\n`)
  if (r.erro) console.log(`   (erro: ${r.erro})`)
  terminal.prompt()
}
terminal.close()
