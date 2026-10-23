// Roda sozinho depois de cada "npm install" (veja "postinstall" no package.json).
// Só faz algo no Android (Termux): troca, dentro de node_modules, dois pacotes que não
// têm versão para Android e derrubam o robô, por versões compatíveis:
//  - sharp (imagens): só serve para pôr borda no QR Code, que o robô não usa.
//  - @ffmpeg-installer/ffmpeg (áudio): passa a usar o ffmpeg do Termux (pkg install ffmpeg).
// Em qualquer outro sistema (Windows, Mac, Linux) não faz nada.
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

export function prepararAndroid(pastaProjeto = join(dirname(fileURLToPath(import.meta.url)), '..'), plataforma = process.platform) {
  if (plataforma !== 'android') return []
  const modulos = join(pastaProjeto, 'node_modules')
  if (!existsSync(modulos)) return []
  const trocados = []

  const trocar = (nome, arquivos) => {
    const pasta = join(modulos, nome)
    rmSync(pasta, { recursive: true, force: true })
    mkdirSync(pasta, { recursive: true })
    for (const [arquivo, conteudo] of Object.entries(arquivos)) writeFileSync(join(pasta, arquivo), conteudo)
    trocados.push(nome)
  }

  trocar('sharp', {
    'package.json': JSON.stringify({
      name: 'sharp', version: '0.35.5', description: 'versão vazia para Android (chatbot-whatsapp)',
      main: 'index.cjs', exports: { import: './index.mjs', require: './index.cjs', default: './index.cjs' },
    }, null, 2),
    'index.cjs': `// versão vazia do sharp para Android: aceita tudo e não faz nada
function criar() {
  const corrente = new Proxy({}, { get(_, nome) {
    if (nome === 'then') return undefined
    if (nome === 'toFile') return (_c, cb) => (typeof cb === 'function' ? cb(null, {}) : Promise.resolve({}))
    if (nome === 'toBuffer') return () => Promise.reject(new Error('sharp indisponível no Android'))
    if (nome === 'metadata') return () => Promise.resolve({})
    return () => corrente
  } })
  const sharp = () => corrente
  sharp.default = sharp
  sharp.cache = sharp.concurrency = sharp.simd = () => {}
  return sharp
}
module.exports = criar()
`,
    'index.mjs': "import sharp from './index.cjs'\nexport default sharp\n",
  })

  trocar('@ffmpeg-installer/ffmpeg', {
    'package.json': JSON.stringify({ name: '@ffmpeg-installer/ffmpeg', version: '1.1.0', main: 'index.js' }, null, 2),
    'index.js': "// no Android usa o ffmpeg do Termux (pkg install ffmpeg)\nmodule.exports = { path: 'ffmpeg', version: 'termux', url: '' }\n",
  })
  return trocados
}

// quando roda direto (node src/preparar-android.js)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const nome of prepararAndroid()) console.log(`✓ Android: ${nome} trocado por uma versão compatível`)
}
