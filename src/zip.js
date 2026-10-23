// Abre arquivos .zip sem pacote extra. Serve para a conversa exportada pelo iPhone,
// que chega como "Conversa do WhatsApp com Fulano.zip" com o _chat.txt dentro.
import { inflateRawSync } from 'node:zlib'

const FIM_DO_ZIP = Buffer.from([0x50, 0x4b, 0x05, 0x06])

export function arquivosDoZip(zip) {
  const fim = zip.lastIndexOf(FIM_DO_ZIP)
  if (fim < 0) throw new Error('não é um arquivo .zip')
  const total = zip.readUInt16LE(fim + 10)
  let p = zip.readUInt32LE(fim + 16)
  const arquivos = []
  for (let i = 0; i < total && zip.readUInt32LE(p) === 0x02014b50; i++) {
    const metodo = zip.readUInt16LE(p + 10)
    const tamanho = zip.readUInt32LE(p + 20)
    const tamNome = zip.readUInt16LE(p + 28)
    const tamExtra = zip.readUInt16LE(p + 30)
    const tamComentario = zip.readUInt16LE(p + 32)
    const inicioLocal = zip.readUInt32LE(p + 42)
    const nome = zip.toString('utf8', p + 46, p + 46 + tamNome)
    arquivos.push({
      nome,
      ler() {
        const ini = inicioLocal + 30 + zip.readUInt16LE(inicioLocal + 26) + zip.readUInt16LE(inicioLocal + 28)
        const dados = zip.subarray(ini, ini + tamanho)
        if (metodo === 0) return Buffer.from(dados)
        if (metodo === 8) return inflateRawSync(dados)
        throw new Error('formato de compactação não suportado')
      },
    })
    p += 46 + tamNome + tamExtra + tamComentario
  }
  return arquivos
}

// Texto da conversa dentro do zip (prefere o _chat.txt do iPhone)
export function textoDoZip(zip) {
  const txts = arquivosDoZip(zip).filter((a) => /\.txt$/i.test(a.nome) && !a.nome.startsWith('__MACOSX'))
  const escolhido = txts.find((a) => /_chat\.txt$/i.test(a.nome)) || txts[0]
  return escolhido ? escolhido.ler().toString('utf8') : ''
}
