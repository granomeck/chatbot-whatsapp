// Usado só no Android (veja compat-android.js): quando algum pacote fizer import('sharp'),
// entrega a versão vazia em vez da original, que não funciona no Android.
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'sharp') {
    return { url: new URL('./sharp-falso.js', import.meta.url).href, shortCircuit: true }
  }
  return proximo(especificador, contexto)
}
