// IA de mentirinha, usada quando ainda não tem chave do Gemini (modo demonstração).
// Procura no meu-negocio.txt a linha que tem a palavra que o cliente usou.

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const PALAVRAS = ['preco', 'valor', 'quanto', 'horario', 'abre', 'fecha', 'entrega', 'frete', 'pagamento', 'pix', 'cartao', 'black', 'promo', 'endereco', 'onde']

export function criarIADemo(conhecimento) {
  const linhas = (conhecimento.negocio || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.includes(':')) // só linhas com informação, não títulos
  return {
    async gerar({ historico, anexo }) {
      if (anexo) return `[modo demonstração: recebi ${anexo.tipo === 'audio' ? 'um áudio' : 'uma imagem'}. Com a chave do Gemini no .env eu entendo e respondo.] Pode me escrever sua dúvida?`
      const pergunta = normalizar(historico[historico.length - 1].texto)
      const palavra = PALAVRAS.find((p) => pergunta.includes(p))
      const linha = palavra && linhas.find((l) => normalizar(l).includes(palavra.slice(0, 5)))
      if (linha) return `${linha.replace(/^[-•*]\s*/, '')}\n\nPosso te ajudar com mais alguma coisa?`
      if (/^(oi|ola|bom dia|boa tarde|boa noite)/.test(pergunta)) return 'Olá! Tudo bem? Como posso te ajudar hoje?'
      return '[modo demonstração: coloque sua chave do Gemini no arquivo .env para eu responder de verdade] Vou chamar uma pessoa da equipe para te ajudar! [CHAMAR_HUMANO]'
    },
  }
}
