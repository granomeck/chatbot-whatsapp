#!/usr/bin/env bash
# =====================================================================
#  ATUALIZAR O ROBÔ
#  Rode depois de QUALQUER mudança (no meu-negocio.txt, no .env, nas
#  conversas ou no código, feita por você ou por uma IA):
#
#      bash ~/chatbot-whatsapp/atualizar.sh
#
#  Ele confere se está tudo certo e reinicia o robô com as mudanças.
#  Se algo estiver errado, ele NÃO reinicia e o robô antigo continua no ar.
# =====================================================================
set -u
cd "$(dirname "$0")" || exit 1
TMP_ROBO="${TMPDIR:-/tmp}"   # no Termux o /tmp não existe

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
amarelo() { printf '\033[33m%s\033[0m\n' "$1"; }

echo ""
echo "🔄 Atualizando o robô..."
echo ""

# 1. Configurações
if [ ! -f .env ]; then
  vermelho "✗ Não achei o arquivo .env."
  echo "  Rode:  cp .env.example .env   e depois preencha com:  nano .env"
  exit 1
fi
verde "✓ Arquivo de configuração (.env) encontrado"

if [ ! -s meu-negocio.txt ]; then
  amarelo "! O meu-negocio.txt está vazio: o robô vai chamar você para quase tudo."
else
  verde "✓ Informações do negócio (meu-negocio.txt) carregadas"
fi

QTD_CONVERSAS=$(ls conversas/*.txt 2>/dev/null | wc -l | tr -d ' ')
verde "✓ Conversas de exemplo: $QTD_CONVERSAS"

# 2. Pacotes (só instala se o package.json mudou ou se nunca instalou)
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "… Instalando pacotes (pode demorar alguns minutos)"
  if ! npm install --no-audit --no-fund; then
    vermelho "✗ Falhou ao instalar os pacotes. Copie o erro acima e mande para uma IA."
    exit 1
  fi
  touch node_modules
fi
node src/preparar-android.js
verde "✓ Pacotes em dia"

# 3. Confere se o código não tem erro de digitação
ERRO=0
for arquivo in app.js simulador.js src/*.js; do
  if ! node --check "$arquivo" 2>"$TMP_ROBO/erro-robo.txt"; then
    vermelho "✗ Erro no arquivo $arquivo:"
    cat "$TMP_ROBO/erro-robo.txt"
    ERRO=1
  fi
done
if [ "$ERRO" = 1 ]; then
  vermelho "Corrija o erro acima (ou mande para uma IA) e rode este comando de novo."
  exit 1
fi
verde "✓ Código sem erros de digitação"

# 4. Testes automáticos
if ! npm run testar --silent > "$TMP_ROBO/testes-robo.txt" 2>&1; then
  vermelho "✗ Algum teste falhou. Veja o resumo:"
  grep -E "^not ok|# (pass|fail)" "$TMP_ROBO/testes-robo.txt"
  echo "  Detalhes completos em $TMP_ROBO/testes-robo.txt (mande para uma IA se precisar)."
  exit 1
fi
verde "✓ Testes automáticos passando"

# 5. Reinicia o robô
if command -v pm2 >/dev/null 2>&1 && pm2 describe robo >/dev/null 2>&1; then
  pm2 restart robo --update-env >/dev/null && pm2 save >/dev/null
  verde "✓ Robô reiniciado com as mudanças"
  echo "  Para ver o que está acontecendo:  pm2 logs robo"
else
  amarelo "! O robô não está rodando pelo pm2."
  echo "  Para ligar agora:  npm start"
  echo "  Para deixar 24h:   npm install -g pm2  e depois  pm2 start app.js --name robo && pm2 save"
fi

echo ""
verde "Pronto! Sucesso!"
