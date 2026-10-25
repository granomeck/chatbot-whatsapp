@echo off
rem =====================================================================
rem  ATUALIZAR O ROBO (Windows)
rem  Rode depois de qualquer mudanca: de dois cliques neste arquivo,
rem  ou no cmd dentro da pasta do robo digite:  atualizar.bat
rem  (No Git Bash tambem funciona:  bash atualizar.sh)
rem =====================================================================
cd /d "%~dp0"
echo.
echo Atualizando o robo...
if not exist .env (
  echo [X] Nao achei o arquivo .env. Copie o .env.example com o nome .env e preencha.
  pause & exit /b 1
)
echo [OK] Arquivo .env encontrado
call npm install --no-audit --no-fund || (echo [X] Falhou ao instalar os pacotes. & pause & exit /b 1)
for %%f in (app.js simulador.js src\*.js) do (
  node --check "%%f" || (echo [X] Erro no arquivo %%f. Corrija ou mande o erro para uma IA. & pause & exit /b 1)
)
echo [OK] Codigo sem erros de digitacao
call npm run testar --silent > "%TEMP%\testes-robo.txt" 2>&1 || (echo [X] Algum teste falhou. Veja %TEMP%\testes-robo.txt & pause & exit /b 1)
echo [OK] Testes automaticos passando
rem Reinicia o robo: fecha a janela "Robo WhatsApp" e abre de novo (ou usa o pm2, se voce instalou)
tasklist /v /fi "WINDOWTITLE eq Robo WhatsApp*" 2>nul | find /i "Robo WhatsApp" >nul
if not errorlevel 1 (
  taskkill /fi "WINDOWTITLE eq Robo WhatsApp*" /t /f >nul 2>&1
  start "" "%~dp0ligar-robo.bat"
  echo [OK] Robo reiniciado com as mudancas
) else (
  where pm2 >nul 2>nul && (call pm2 restart robo --update-env && call pm2 save && echo [OK] Robo reiniciado com as mudancas) || echo [!] Para ligar o robo: dois cliques no atalho "Robo WhatsApp" ou no arquivo ligar-robo.bat
)
echo.
echo Pronto! Sucesso!
pause
