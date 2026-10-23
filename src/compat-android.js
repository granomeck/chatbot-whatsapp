// Compatibilidade com Android (Termux).
// Dois pacotes que o BuilderBot usa não têm versão para Android e derrubam o robô:
//  - "@ffmpeg-installer/ffmpeg" (conversão de áudio): trava ao ligar com
//    "Unsupported platform/architecture: android-arm64". Trocamos pelo ffmpeg do Termux
//    (o robô não precisa dele; se um dia precisar: pkg install ffmpeg).
//  - "sharp" (imagens): só serve para pôr uma borda branca na imagem do QR Code.
//    Trocamos por uma versão vazia: o QR fica sem borda e o robô segue normal.
import Module, { register } from 'node:module'
import { criarSharpFalso } from './sharp-falso.js'

export const EH_ANDROID = process.platform === 'android'

if (EH_ANDROID) {
  // para quem usa require() (pacotes antigos, em CommonJS)
  const carregarOriginal = Module._load
  Module._load = function (pedido, ...resto) {
    if (pedido === '@ffmpeg-installer/ffmpeg') return { path: 'ffmpeg', version: 'termux', url: '' }
    if (pedido === 'sharp') return criarSharpFalso()
    return carregarOriginal.call(this, pedido, ...resto)
  }
  // para quem usa import('sharp') (é assim que o BuilderBot carrega)
  register('./android-gancho.js', import.meta.url)
}
