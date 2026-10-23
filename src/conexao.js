// Conexão com o WhatsApp por CÓDIGO (sem QR Code).
// O BuilderBot 1.4 pede o código antes de a conexão estar pronta, e o WhatsApp recusa
// com "428 Connection Closed". Aqui o robô espera o WhatsApp avisar que está pronto
// (o momento em que ele mandaria um QR Code) e só então pede o código. O QR nunca é mostrado.

export function mostrarCodigo(codigo, log = console.log) {
  const bonito = String(codigo).replace(/^(.{4})(.{4})$/, '$1-$2')
  log('\n==============================================')
  log(`   CÓDIGO PARA CONECTAR:  ${bonito}`)
  log('==============================================')
  log('No WhatsApp do robô: ⋮ → Dispositivos conectados → Conectar dispositivo')
  log('→ Conectar com número de telefone → digite o código (vence em ~1 minuto).\n')
}

export function ligarConexaoPorCodigo(provider, numero, log = console.log) {
  let ultimaConexao = null // um código por conexão: não gera um código novo a cada 20 segundos
  const emitirOriginal = provider.emit.bind(provider)

  provider.emit = function (evento, dados, ...resto) {
    if (evento === 'require_action' && dados?.payload?.qr) {
      const sock = provider.vendor
      if (sock && sock !== ultimaConexao && typeof sock.requestPairingCode === 'function') {
        ultimaConexao = sock
        sock
          .requestPairingCode(numero)
          .then((codigo) => mostrarCodigo(codigo, log))
          .catch((e) => {
            ultimaConexao = null // tenta de novo no próximo aviso do WhatsApp
            log(`⚠️  O WhatsApp ainda não aceitou o pedido de código (${e?.message || e}). Tentando de novo…`)
          })
      }
      return true // o aviso de "escaneie o QR Code" não é repassado: aqui é só por código
    }
    if (evento === 'auth_failure') {
      log('⚠️  Problema na conexão com o WhatsApp. Detalhes no arquivo baileys.log (mande para uma IA se precisar).')
    }
    return emitirOriginal(evento, dados, ...resto)
  }
}
