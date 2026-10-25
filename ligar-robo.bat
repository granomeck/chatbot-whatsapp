@echo off
rem =====================================================================
rem  LIGA O ROBO NO COMPUTADOR (Windows). O atalho "Robo WhatsApp" abre este arquivo.
rem  Deixe esta janela aberta (pode minimizar). Se o robo cair, ele religa sozinho.
rem =====================================================================
chcp 65001 >nul
title Robo WhatsApp
cd /d "%~dp0"
:inicio
echo.
echo  ROBO WHATSAPP LIGADO - nao feche esta janela (pode minimizar).
echo.
node app.js
echo.
echo  O robo parou. Religando em 10 segundos... (para desligar de vez, feche esta janela)
timeout /t 10 /nobreak >nul
goto inicio
