#!/usr/bin/env bash
# =====================================================================
#  INSTALADOR DO ROBÔ — cole no Termux (Android) e aperte Enter:
#
#  pkg install -y curl && curl -fsSL https://raw.githubusercontent.com/granomeck/chatbot-whatsapp/main/instalar.sh | bash
#
#  Ele instala tudo, baixa o robô, pergunta a sua chave e os números,
#  liga o robô 24h e mostra o código para conectar no WhatsApp.
#  Pode rodar de novo quando quiser: ele só atualiza o que precisa.
# =====================================================================
set -u
REPO="https://github.com/granomeck/chatbot-whatsapp"
PASTA="$HOME/chatbot-whatsapp"

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
titulo() { printf '\n\033[1;33m%s\033[0m\n' "$1"; }
falhou() { vermelho "✗ $1"; echo "  Tire um print desta tela e mande para uma IA (Claude, ChatGPT ou Gemini)."; exit 1; }

# Lê uma resposta do teclado mesmo quando o script vem pelo "curl | bash".
# (Se a variável já existir, usa ela: serve para testes.)
perguntar() {
  local var="$1" texto="$2" valor="${!1:-}"
  while [ -z "$valor" ]; do
    printf '%s ' "$texto"
    read -r valor < /dev/tty || falhou "Não consegui ler o teclado."
  done
  printf -v "$var" '%s' "$valor"
}
so_numeros() { printf '%s' "$1" | tr -cd '0-9'; }

echo ""
verde "🤖 Instalando o robô de WhatsApp com IA"

# ---------------------------------------------------------------- 1
titulo "1/5 · Preparando o aparelho"
if { [ -n "${TERMUX_VERSION:-}" ] || [[ "${PREFIX:-}" == *com.termux* ]]; } && command -v pkg >/dev/null 2>&1; then
  pkg update -y -o Dpkg::Options::=--force-confnew >/dev/null 2>&1 || true
  pkg upgrade -y -o Dpkg::Options::=--force-confnew || falhou "Não consegui atualizar o Termux."
  pkg install -y nodejs-lts git nano || falhou "Não consegui instalar o Node.js e o Git."
fi
command -v node >/dev/null 2>&1 || falhou "O Node.js não está instalado."
command -v git  >/dev/null 2>&1 || falhou "O Git não está instalado."
VERSAO=$(node -p 'process.versions.node.split(".")[0]')
[ "$VERSAO" -ge 20 ] || falhou "O seu Node.js é a versão $VERSAO. O robô precisa da 20 ou mais nova."
verde "✓ Node.js $(node -v) e Git prontos"

# ---------------------------------------------------------------- 2
titulo "2/5 · Baixando o robô"
if [ -d "$PASTA/.git" ]; then
  git -C "$PASTA" pull --ff-only >/dev/null 2>&1 && verde "✓ Robô atualizado com a versão mais nova" || verde "✓ Robô já baixado (mantive a sua versão)"
else
  git clone --depth 1 "$REPO" "$PASTA" || falhou "Não consegui baixar o robô. Confira a internet."
  verde "✓ Robô baixado em $PASTA"
fi
cd "$PASTA" || falhou "Não achei a pasta do robô."

# ---------------------------------------------------------------- 3
titulo "3/5 · Instalando os pacotes (pode demorar uns minutos)"
npm install --no-audit --no-fund || falhou "A instalação dos pacotes falhou."
verde "✓ Pacotes instalados"

# ---------------------------------------------------------------- 4
titulo "4/5 · Configurando"
if [ -f .env ]; then
  verde "✓ Configuração já existe (para mudar: nano $PASTA/.env)"
else
  echo "Crie a sua chave grátis em: https://aistudio.google.com/apikey"
  perguntar GEMINI_API_KEY "Cole a chave do Gemini e aperte Enter:"
  perguntar NOME_DO_NEGOCIO "Nome do seu negócio:"
  perguntar SEU_WHATSAPP_PESSOAL "Seu WhatsApp PESSOAL (recebe os avisos), com DDD:"
  perguntar NUMERO_DO_ROBO "Número do WhatsApp do ROBÔ, com DDD:"
  P=$(so_numeros "$SEU_WHATSAPP_PESSOAL"); R=$(so_numeros "$NUMERO_DO_ROBO")
  case "$P" in 55*) ;; *) P="55$P" ;; esac
  case "$R" in 55*) ;; *) R="55$R" ;; esac
  node -e '
    const fs = require("fs"); const [chave, nome, pessoal, robo] = process.argv.slice(1);
    let t = fs.readFileSync(".env.example", "utf8");
    const pôr = (k, v) => { t = t.replace(new RegExp("^" + k + "=.*$", "m"), k + "=" + v) };
    pôr("GEMINI_API_KEY", chave.trim()); pôr("NOME_DO_NEGOCIO", nome.trim());
    pôr("SEU_WHATSAPP_PESSOAL", pessoal); pôr("NUMERO_DO_ROBO", robo);
    fs.writeFileSync(".env", t);
  ' "$GEMINI_API_KEY" "$NOME_DO_NEGOCIO" "$P" "$R" || falhou "Não consegui salvar a configuração."
  verde "✓ Configuração salva"
fi

# ---------------------------------------------------------------- 5
titulo "5/5 · Ligando o robô 24h"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2 --no-audit --no-fund >/dev/null 2>&1 || falhou "Não consegui instalar o pm2."
if pm2 describe robo >/dev/null 2>&1; then pm2 restart robo --update-env >/dev/null; else pm2 start app.js --name robo >/dev/null; fi
pm2 save >/dev/null 2>&1
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
# Ao abrir o Termux, o robô volta sozinho (útil depois de reiniciar o celular)
grep -q "pm2 resurrect" "$HOME/.bashrc" 2>/dev/null || echo 'pm2 resurrect >/dev/null 2>&1; termux-wake-lock 2>/dev/null' >> "$HOME/.bashrc"
verde "✓ Robô ligado"

echo ""
verde "======================================================"
verde " PRONTO! Agora conecte o WhatsApp do robô:"
echo "  1. Logo abaixo vai aparecer um CÓDIGO de 8 caracteres."
echo "  2. No WhatsApp Business: ⋮ → Dispositivos conectados →"
echo "     Conectar dispositivo → Conectar com número de telefone."
echo "  3. Digite o código (ele vence em cerca de 1 minuto)."
echo "  Depois de conectar, pode fechar esta tela: o robô continua ligado."
echo ""
echo "  Seu negócio:  nano $PASTA/meu-negocio.txt"
echo "  Atualizar:    bash $PASTA/atualizar.sh"
verde "======================================================"
echo ""
if [ -t 1 ] && [ -z "${SEM_LOGS:-}" ]; then
  sleep 3
  pm2 logs robo --lines 30
fi
