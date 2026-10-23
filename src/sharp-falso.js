// Versão "vazia" do sharp para o Android, onde o sharp de verdade não funciona.
// Qualquer operação é aceita e ignorada: salvar o arquivo (toFile) deixa a imagem como estava;
// pedir o resultado em memória (toBuffer) devolve um erro que quem chamou consegue tratar.
export function criarSharpFalso() {
  const corrente = new Proxy({}, {
    get(_, nome) {
      if (nome === 'then') return undefined // não é uma promessa
      if (nome === 'toFile') {
        return (_caminho, callback) => (typeof callback === 'function' ? callback(null, {}) : Promise.resolve({}))
      }
      if (nome === 'toBuffer') return () => Promise.reject(new Error('sharp indisponível no Android'))
      if (nome === 'metadata') return () => Promise.resolve({})
      return () => corrente
    },
  })
  const sharp = () => corrente
  sharp.default = sharp
  sharp.cache = sharp.concurrency = sharp.simd = () => {}
  return sharp
}

const sharp = criarSharpFalso()
export default sharp
