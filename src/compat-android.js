// Compatibilidade com Android (Termux).
// O BuilderBot carrega o pacote "@ffmpeg-installer/ffmpeg" assim que liga, e esse pacote
// não tem versão para Android: ele trava com "Unsupported platform/architecture: android-arm64".
// Aqui, só no Android, trocamos esse pacote pelo ffmpeg do próprio Termux.
// O robô não precisa de ffmpeg para atender por texto; se um dia precisar converter áudio,
// basta rodar no Termux:  pkg install ffmpeg
import Module from 'node:module'

export const EH_ANDROID = process.platform === 'android'

if (EH_ANDROID) {
  const carregarOriginal = Module._load
  Module._load = function (pedido, ...resto) {
    if (pedido === '@ffmpeg-installer/ffmpeg') {
      return { path: 'ffmpeg', version: 'termux', url: 'https://wiki.termux.com' }
    }
    return carregarOriginal.call(this, pedido, ...resto)
  }
}
