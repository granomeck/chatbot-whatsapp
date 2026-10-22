// Conversa com o Gemini (Google) direto pela internet, sem instalar pacote nenhum.
// Usa a chave grátis como principal. Se ela bater o limite ou falhar, e existir uma
// chave de reserva (paga), tenta de novo com a reserva.

const DEVE_TENTAR_RESERVA = (status) => status === 429 || status >= 500 || status === undefined

async function chamarGemini({ chave, modelo, instrucoes, historico }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instrucoes }] },
      contents: historico.map((m) => ({ role: m.papel === 'robo' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
    }),
  })
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '')
    const erro = new Error(`Gemini respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`)
    erro.status = resposta.status
    throw erro
  }
  const dados = await resposta.json()
  const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!texto.trim()) throw new Error('O Gemini não devolveu texto (pode ter sido bloqueado pelo filtro de segurança).')
  return texto
}

export function criarIAGemini({ chave, chaveReserva = '', modelo, aoUsarReserva = () => {} }) {
  return {
    async gerar({ instrucoes, historico }) {
      try {
        return await chamarGemini({ chave, modelo, instrucoes, historico })
      } catch (erro) {
        if (!chaveReserva || !DEVE_TENTAR_RESERVA(erro.status)) throw erro
        aoUsarReserva(erro)
        return chamarGemini({ chave: chaveReserva, modelo, instrucoes, historico })
      }
    },
  }
}
