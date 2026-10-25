# =====================================================================
#  INSTALADOR DO ROBÔ NO COMPUTADOR (Windows 10 ou 11)
#  Abra o PowerShell (tecla Windows, digite PowerShell, Enter), cole e aperte Enter:
#
#  irm https://raw.githubusercontent.com/granomeck/chatbot-whatsapp/main/instalar.ps1 | iex
#
#  Ele instala o Node.js (se faltar), baixa o robô, pergunta a sua chave
#  e os números, cria o atalho "Robô WhatsApp" e mostra o código para
#  conectar no WhatsApp. Pode rodar de novo quando quiser: ele atualiza
#  o robô e mantém as suas configurações, o meu-negocio.txt e as conversas.
# =====================================================================
function Instalar-RoboWhatsApp {
  $ErrorActionPreference = 'Stop'
  try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
  $ProgressPreference = 'SilentlyContinue'   # deixa o download bem mais rápido no PowerShell antigo
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

  $windows = ($env:OS -eq 'Windows_NT')
  $casa = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
  $pasta = if ($env:CHATBOT_PASTA) { $env:CHATBOT_PASTA } else { Join-Path $casa 'chatbot-whatsapp' }
  $zipUrl = 'https://github.com/granomeck/chatbot-whatsapp/archive/refs/heads/main.zip'
  $npm = if ($windows) { 'npm.cmd' } else { 'npm' }   # npm.cmd evita o bloqueio de scripts do PowerShell

  function Verde($t) { Write-Host $t -ForegroundColor Green }
  function Titulo($t) { Write-Host ''; Write-Host $t -ForegroundColor Yellow }
  function Falhou($t) {
    Write-Host "X $t" -ForegroundColor Red
    Write-Host '  Tire um print desta tela e mande para uma IA (Claude, ChatGPT ou Gemini).'
    throw 'parou'
  }
  function Perguntar($nomeVar, $texto) {
    $v = [Environment]::GetEnvironmentVariable($nomeVar)   # já preenchido = usa (serve para testes)
    while (-not $v) { $v = Read-Host $texto }
    return $v.Trim()
  }
  function SoNumeros($t) { return ($t -replace '\D', '') }
  function Com55($t) { $n = SoNumeros $t; if ($n -notmatch '^55') { $n = "55$n" }; return $n }
  function AtualizarPath {
    if ($windows) {
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }
  }
  function VersaoNode {
    try { $v = (& node -v) 2>$null; if ($v -match 'v(\d+)\.') { return [int]$Matches[1] } } catch {}
    return 0
  }

  Write-Host ''
  Verde '=== Instalando o robô de WhatsApp com IA ==='

  # ------------------------------------------------------------------ 1
  Titulo '1/5 · Node.js (o programa que faz o robô funcionar)'
  if ((VersaoNode) -lt 20) {
    if (-not $windows) { Falhou 'Instale o Node.js 20 ou mais novo: https://nodejs.org/pt/download' }
    Write-Host 'Instalando o Node.js... (se o Windows perguntar se pode fazer alterações, clique em Sim)'
    $ok = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      & winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements | Out-Host
      AtualizarPath; $ok = ((VersaoNode) -ge 20)
    }
    if (-not $ok) {
      # sem o winget: baixa o instalador oficial direto do nodejs.org
      $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts } | Select-Object -First 1
      $arq = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
      $msi = Join-Path $env:TEMP "node-$($lts.version)-$arq.msi"
      Invoke-WebRequest "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-$arq.msi" -OutFile $msi -UseBasicParsing
      Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait
      AtualizarPath
    }
    if ((VersaoNode) -lt 20) { Falhou 'Não consegui instalar o Node.js. Instale pelo site https://nodejs.org/pt/download (versão LTS) e rode este comando de novo.' }
  }
  Verde "[OK] Node.js $(& node -v) pronto"

  # ------------------------------------------------------------------ 2
  Titulo '2/5 · Baixando o robô'
  $primeiraVez = -not (Test-Path (Join-Path $pasta 'app.js'))
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("robo-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'robo.zip'
  try {
    if ($env:CHATBOT_ZIP_LOCAL) { Copy-Item $env:CHATBOT_ZIP_LOCAL $zip } else { Invoke-WebRequest $zipUrl -OutFile $zip -UseBasicParsing }
    Expand-Archive $zip -DestinationPath $tmp -Force
  } catch { Falhou 'Não consegui baixar o robô. Confira a internet.' }
  $origem = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (-not $origem) { Falhou 'O download do robô veio vazio.' }
  # o que é SEU nunca é substituído: configurações, conexão, textos do negócio e conversas
  $protegidos = @('.env', 'ajustes.json', 'db.json', 'meu-negocio.txt', 'meu-negocio.anterior.txt')
  $pastasProtegidas = @('node_modules', 'bot_sessions', 'conversas')
  New-Item -ItemType Directory -Path $pasta -Force | Out-Null
  $base = $origem.FullName.TrimEnd('\', '/')
  foreach ($f in Get-ChildItem $base -Recurse -File -Force) {
    $rel = $f.FullName.Substring($base.Length + 1)
    $primeiro = ($rel -split '[\\/]')[0]
    $destino = Join-Path $pasta $rel
    if ((Test-Path $destino) -and (($protegidos -contains $rel) -or ($pastasProtegidas -contains $primeiro))) { continue }
    New-Item -ItemType Directory -Path (Split-Path $destino) -Force | Out-Null
    Copy-Item $f.FullName $destino -Force
  }
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  if ($primeiraVez) { Verde "[OK] Robô baixado em $pasta" } else { Verde '[OK] Robô atualizado (suas configurações e textos foram mantidos)' }
  Set-Location $pasta

  # ------------------------------------------------------------------ 3
  Titulo '3/5 · Instalando os pacotes (pode demorar uns minutos)'
  if (-not $env:CHATBOT_PULAR_NPM) {
    & $npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Falhou 'A instalação dos pacotes falhou.' }
  }
  Verde '[OK] Pacotes instalados'

  # ------------------------------------------------------------------ 4
  Titulo '4/5 · Configurando'
  $arqEnv = Join-Path $pasta '.env'
  if (Test-Path $arqEnv) {
    Verde "[OK] Configuração já existe (para mudar: notepad `"$arqEnv`")"
  } else {
    Write-Host 'Crie a sua chave grátis em: https://aistudio.google.com/apikey'
    $chave = Perguntar 'GEMINI_API_KEY' 'Cole a chave do Gemini e aperte Enter'
    $nome = Perguntar 'NOME_DO_NEGOCIO' 'Nome do seu negócio'
    $pessoal = Com55 (Perguntar 'SEU_WHATSAPP_PESSOAL' 'Seu WhatsApp PESSOAL (recebe os avisos), com DDD')
    $robo = Com55 (Perguntar 'NUMERO_DO_ROBO' 'Número do WhatsApp do ROBÔ, com DDD')
    $t = [IO.File]::ReadAllText((Join-Path $pasta '.env.example'))
    $valores = [ordered]@{ GEMINI_API_KEY = $chave; NOME_DO_NEGOCIO = $nome; SEU_WHATSAPP_PESSOAL = $pessoal; NUMERO_DO_ROBO = $robo }
    foreach ($k in $valores.Keys) {
      $linha = "$k=" + $valores[$k]
      $t = [regex]::Replace($t, "(?m)^$k=.*$", { param($m) $linha })
    }
    [IO.File]::WriteAllText($arqEnv, $t, (New-Object Text.UTF8Encoding $false))   # sem BOM
    Verde '[OK] Configuração salva'
  }

  # ------------------------------------------------------------------ 5
  Titulo '5/5 · Ligando o robô'
  $ligar = Join-Path $pasta 'ligar-robo.bat'
  if ($windows) {
    $sh = New-Object -ComObject WScript.Shell
    $atalho = $sh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Robô WhatsApp.lnk'))
    $atalho.TargetPath = $ligar; $atalho.WorkingDirectory = $pasta; $atalho.Save()
    Verde '[OK] Atalho "Robô WhatsApp" criado na área de trabalho'
    $resp = if ($env:CHATBOT_INICIAR_JUNTO) { $env:CHATBOT_INICIAR_JUNTO } else { Read-Host 'Ligar o robô sozinho sempre que o computador ligar? (S/N)' }
    $inicio = Join-Path ([Environment]::GetFolderPath('Startup')) 'Robô WhatsApp.lnk'
    if ($resp -match '^[sS]') {
      $a2 = $sh.CreateShortcut($inicio); $a2.TargetPath = $ligar; $a2.WorkingDirectory = $pasta; $a2.WindowStyle = 7; $a2.Save()
      Verde '[OK] O robô vai ligar sozinho quando o computador ligar'
    } elseif (Test-Path $inicio) { Remove-Item $inicio -Force }
    $resp2 = if ($env:CHATBOT_SEM_SUSPENSAO) { $env:CHATBOT_SEM_SUSPENSAO } else { Read-Host 'Impedir o computador de "dormir" quando estiver na tomada? Senão o robô para. (S/N)' }
    if ($resp2 -match '^[sS]') { & cmd.exe /c 'powercfg /change standby-timeout-ac 0 >nul 2>&1'; Verde '[OK] Suspensão desligada (na tomada)' }
    # fecha um robô que já esteja aberto e liga de novo, já com a versão nova
    & cmd.exe /c 'taskkill /fi "WINDOWTITLE eq Robo WhatsApp*" /t /f >nul 2>&1'
    Start-Process -FilePath $ligar -WorkingDirectory $pasta
  }
  Verde '[OK] Robô ligado'

  Write-Host ''
  Verde '======================================================'
  Verde ' PRONTO! Agora conecte o WhatsApp do robô:'
  Write-Host '  1. Abriu uma janela preta chamada "Robo WhatsApp".'
  Write-Host '     Nela vai aparecer um CÓDIGO de 8 caracteres.'
  Write-Host '  2. No WhatsApp Business: 3 pontinhos > Dispositivos conectados >'
  Write-Host '     Conectar dispositivo > Conectar com número de telefone.'
  Write-Host '  3. Digite o código (ele vence em cerca de 1 minuto).'
  Write-Host '  NÃO feche a janela "Robo WhatsApp" (pode minimizar).'
  Write-Host '  Para ligar depois: atalho "Robô WhatsApp" na área de trabalho.'
  Write-Host ''
  Write-Host "  Atualizar o robô: dois cliques em $pasta\atualizar.bat"
  Verde '======================================================'
  Write-Host ''
}
try { Instalar-RoboWhatsApp } catch { if ("$_" -ne 'parou') { Write-Host "X Erro: $_" -ForegroundColor Red; Write-Host '  Tire um print desta tela e mande para uma IA (Claude, ChatGPT ou Gemini).' } }
