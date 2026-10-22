# Instruções para a IA que estiver ajudando com este robô

Se você é uma IA (Claude, ChatGPT, Gemini…) e o dono do robô colou este arquivo ou pediu ajuda com este projeto, leia isto antes de sugerir mudanças.

## O que é

Robô de atendimento no WhatsApp, em Node.js (versão 20 ou mais nova), feito com [BuilderBot](https://www.builderbot.app) e a conexão Baileys (WhatsApp Web). Quem responde é o Gemini, pela API grátis do Google. Roda num celular Android (Termux) ou num PC. Quem usa é **iniciante**: explique passo a passo, sem jargão, e entregue arquivos completos para copiar e colar.

## Onde mexer

| Quer mudar… | Arquivo |
| --- | --- |
| O que o robô sabe (produtos, preços, horário, promoções) | `meu-negocio.txt` (texto livre, sem código) |
| Chave, nome do negócio, números, horário, pausa | `.env` (modelo em `.env.example`) |
| Jeito de falar, regras, quando chamar um humano | `src/cerebro.js`, função `montarInstrucoes` |
| Palavras que fazem o robô chamar uma pessoa | `src/cerebro.js`, constante `PEDIDO_HUMANO` |
| Conexão com o Gemini, chave de reserva | `src/ia-gemini.js` |
| Ligação com o WhatsApp (digitando, aviso ao dono, grupos) | `app.js` |
| Como as conversas exportadas são limpas | `src/limpar-conversas.js` |

O cérebro (`src/cerebro.js`) não depende do WhatsApp. Por isso dá para testar tudo com `npm run simular` e com os testes em `testes/`.

## Regras ao sugerir mudanças

1. **Depois de qualquer mudança, peça para o dono rodar:**

   ```
   bash ~/chatbot-whatsapp/atualizar.sh
   ```

   No Windows, ele dá dois cliques no `atualizar.bat`. O script confere a configuração, instala pacotes se precisar, procura erros de digitação no código, roda os testes e reinicia o robô. Se algo falhar, o robô antigo continua no ar.

2. Entregue o arquivo **inteiro** já alterado, e não só um trecho, porque o dono não sabe programar.
3. Nunca peça para colar a chave do Gemini na conversa nem coloque a chave dentro do código: ela fica só no `.env`.
4. Não transforme o robô em disparador de mensagens em massa: isso faz o número ser bloqueado.
5. Se adicionar uma função nova, adicione também um teste em `testes/robo.test.js`.
6. Para testar sem WhatsApp: `npm run simular`.
