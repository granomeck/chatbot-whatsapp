# 🤖 Robô de WhatsApp com IA — grátis

Um atendente virtual que responde seus clientes no WhatsApp **24 horas por dia**, com inteligência artificial, rodando num **celular Android parado** ou no seu **PC/notebook**. Custo: **R$ 0**.

O que ele faz:

- Responde dúvidas usando as informações do seu negócio (preços, horário, entrega, promoções).
- Aprende o seu jeito de responder com as suas conversas antigas do WhatsApp.
- **Entende áudios e fotos** (o Gemini ouve a mensagem de voz e vê a imagem, e responde por texto).
- Mostra "digitando..." antes de responder, como uma pessoa.
- Quando o cliente pede para falar com alguém, **te avisa no seu WhatsApp pessoal** e fica quieto com esse cliente para você atender.
- Pode responder só no seu horário de atendimento.

---

## ⚠️ Leia antes de começar

Este robô conecta pelo **WhatsApp Web**, que não é a API oficial do WhatsApp.

- Para **atendimento** (o cliente chama e o robô responde) o risco de bloqueio é **baixo, mas não é zero**.
- Para **disparo em massa** (mandar mensagem para quem não te chamou) o risco é **alto**. Este robô não faz disparos, e você não deve adaptá-lo para isso.
- Use um **número separado** para o robô, de preferência um que já tenha algumas semanas de uso.

---

## ⚡ Jeito rápido no Android: uma linha só

1. Instale o **[Termux pela Play Store](https://play.google.com/store/apps/details?id=com.termux)** e coloque a bateria dele em **Sem restrições** (Configurações → Apps → Termux → Bateria).
2. Crie a sua chave grátis do Gemini em **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
3. Abra o Termux, cole esta linha e aperte Enter:

```
pkg install -y curl && curl -fsSL https://raw.githubusercontent.com/granomeck/chatbot-whatsapp/main/instalar.sh | bash
```

Ele instala tudo, baixa o robô, pergunta a chave e os números, liga o robô 24h e mostra o código para conectar no WhatsApp Business (**⋮ → Dispositivos conectados → Conectar dispositivo → Conectar com número de telefone**).

Assim que conecta, o robô manda uma mensagem no seu WhatsApp pessoal e te guia para ensinar a ele sobre o seu negócio (veja o item 4.2). Para mudar algo depois, mande **atualizar** para o robô.

## ⚡ Jeito rápido no computador (Windows 10 ou 11): uma linha só

1. Crie a sua chave grátis do Gemini em **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Aperte a **tecla Windows**, digite **PowerShell** e aperte Enter.
3. Cole esta linha e aperte Enter:

```
irm https://raw.githubusercontent.com/granomeck/chatbot-whatsapp/main/instalar.ps1 | iex
```

Ele instala o Node.js (se o Windows perguntar se pode fazer alterações, clique em **Sim**), baixa o robô, faz as mesmas 4 perguntas, cria o atalho **Robô WhatsApp** na área de trabalho e abre a janela do robô com o código para conectar no WhatsApp Business.

- **Não feche** a janela preta "Robo WhatsApp" (pode minimizar). Se o robô cair, ele religa sozinho.
- O instalador pergunta se o robô deve **ligar sozinho** quando o computador ligar e se pode **tirar a suspensão** (na tomada).
- Para atualizar o robô para a versão mais nova, rode a mesma linha de novo: suas configurações, o `meu-negocio.txt` e as conversas são mantidos.

O passo a passo completo abaixo serve para quem quer entender cada etapa.

---

## O que você precisa

| Item | Onde conseguir |
| --- | --- |
| Um aparelho que fica ligado: celular Android ou PC/notebook | O que você já tem |
| Um número de WhatsApp para o robô (o app pode estar num Android **ou num iPhone**) | Um chip separado |
| Uma chave grátis do Gemini (a IA do Google) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

**Tem só iPhone?** O iPhone não consegue rodar o robô, mas pode ser o número conectado: o robô roda no PC e você digita o código de conexão no WhatsApp do iPhone.

---

## Passo 1 — Crie a sua chave grátis do Gemini

1. Abra **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** e entre com a sua conta Google.
2. Clique em **Criar chave de API** (Create API key).
3. Copie a chave (um texto comprido que começa com `AIza...`) e guarde num lugar seguro.

> 🔒 A chave é como uma senha. Não mostre para ninguém e não publique em lugar nenhum.

---

## Passo 2 — Prepare o aparelho

### Opção A: celular Android

1. Instale o **[Termux pela Play Store](https://play.google.com/store/apps/details?id=com.termux)** e abra.
2. Copie e cole este comando e aperte Enter (pode demorar alguns minutos; se perguntar algo, aperte Enter):

   ```
   pkg update -y && pkg upgrade -y && pkg install -y nodejs-lts git
   ```

3. Tire a economia de bateria do Termux: **Configurações do Android → Apps → Termux → Bateria → Sem restrições**.

### Opção B: PC ou notebook (Windows)

> O jeito rápido (uma linha no PowerShell, lá em cima) já faz este passo sozinho.

1. Instale o **[Node.js](https://nodejs.org/pt/download)** (versão **LTS**), clicando em "Avançar" até o fim.
2. (Opcional) Instale o **[Git](https://git-scm.com/downloads/win)**, também só clicando em "Avançar". Sem o Git, baixe o robô em **Code → Download ZIP**.

---

## Passo 3 — Baixe o robô

**No Termux** (Android), cole:

```
git clone https://github.com/granomeck/chatbot-whatsapp
cd chatbot-whatsapp
npm install
```

**No PC**, abra a pasta onde quer guardar o robô, clique na barra de endereço lá em cima, digite `cmd` e aperte Enter. Vai abrir uma tela preta já nessa pasta. Cole:

```
git clone https://github.com/granomeck/chatbot-whatsapp
cd chatbot-whatsapp
npm install
```

> Não quer instalar o Git no PC? Na página do projeto no GitHub clique em **Code → Download ZIP**, extraia a pasta, abra o `cmd` dentro dela e rode só `npm install`.

---

## Passo 4 — Configure o robô

### 4.1 Suas configurações (arquivo `.env`)

**No Termux:**

```
cp .env.example .env
nano .env
```

Troque os valores, depois salve com **Ctrl + O**, Enter, e saia com **Ctrl + X**. (O botão CTRL fica na barrinha acima do teclado do Termux.)

**No PC:** copie o arquivo `.env.example`, renomeie a cópia para `.env` e abra com o Bloco de Notas.

O que preencher:

| Campo | O que colocar |
| --- | --- |
| `GEMINI_API_KEY` | A chave do Passo 1 |
| `NOME_DO_NEGOCIO` | O nome do seu negócio |
| `SEU_WHATSAPP_PESSOAL` | Seu WhatsApp pessoal (não o do robô), só números: 55 + DDD + número |
| `HORARIO_ATENDIMENTO` | Em branco = 24h. Ou, por exemplo, `08:00-18:00` |

### 4.2 Ensine o robô sobre o seu negócio: o jeito fácil é pelo WhatsApp

Não precisa mexer em arquivo nenhum. Quando o robô conecta pela primeira vez, ele **manda uma mensagem de configuração no seu WhatsApp pessoal** (o número de `SEU_WHATSAPP_PESSOAL`) e te guia em 2 passos:

1. **Conversas de exemplo:** você exporta conversas com clientes e manda para o robô (⋮ → Mais → Exportar conversa → Sem mídia). Se a conversa estiver no WhatsApp do próprio negócio, mande para o seu WhatsApp pessoal e depois encaminhe para o robô.
2. **Informações do negócio:** o robô te manda um texto pronto para colar numa IA grátis (Claude, ChatGPT ou Gemini) junto com o seu catálogo, prints de preços e o link do seu Instagram ou site. Você cola a resposta da IA na conversa com o robô e pronto.

Depois, para mudar qualquer coisa, mande **atualizar** para o robô:

| Opção | O que faz |
| --- | --- |
| 1 | Troca as informações do negócio (preços, produtos, horário…). Mandou errado? Escreva `desfazer`. |
| 2 | Adiciona mais conversas de exemplo |
| 3 | Muda o horário de atendimento (ex.: `8h às 18h` ou `24h`) |
| 4 | Escolhe para onde vão os avisos: seu WhatsApp ou o **grupo da equipe** |
| 5 | Liga/desliga **pedidos e encomendas**: o robô anota o pedido, confirma com o cliente e manda o resumo para a equipe finalizar |
| 6 | Mostra tudo o que o robô sabe hoje |

Só o seu número consegue usar essas opções. Mensagens normais suas (fora do menu) são respondidas como se você fosse um cliente, bom para testar. Perdeu a mensagem de configuração? Mande `configurar`.

Prefere fazer pelos arquivos? Veja os itens 4.3 e 4.4.

### 4.3 Pelos arquivos: informações do negócio (`meu-negocio.txt`)

Abra o `meu-negocio.txt` (`nano meu-negocio.txt` no Termux, Bloco de Notas no PC), **apague o exemplo** e escreva como se estivesse explicando para um funcionário novo: o que você vende, preços, horário, pagamento, entrega, trocas e as promoções de **Black Friday** e fim de ano.

O robô **nunca inventa preço**: se não estiver nesse arquivo, ele chama você.

### 4.4 Pelos arquivos: suas conversas antigas (pasta `conversas`)

Exporte de 10 a 30 conversas boas do seu WhatsApp e coloque os arquivos `.txt` na pasta `conversas`:

- **Android:** abra a conversa → ⋮ → **Mais** → **Exportar conversa** → **Sem mídia**
- **iPhone:** abra a conversa → toque no nome → **Exportar conversa** → **Sem mídia**

O robô aprende as perguntas que mais chegam e o seu jeito de falar. Ele apaga sozinho telefones, e-mails e nomes dos clientes, mas dê uma olhada antes e apague endereços ou outros dados pessoais.

---

## Passo 5 — Teste antes de ligar no WhatsApp

```
npm run simular
```

Converse como se fosse um cliente. Teste preço, entrega, Black Friday e "quero falar com um atendente". Para testar o menu do dono, comece a mensagem com `dono:` (exemplo: `dono: atualizar`). Se alguma resposta sair errada, melhore o `meu-negocio.txt` e teste de novo. Para sair, digite `sair`.

---

## Passo 6 — Ligue e conecte no WhatsApp

```
npm start
```

A conexão é sempre por **código**, tanto no celular quanto no PC:

1. Confira se o `NUMERO_DO_ROBO` está preenchido no `.env` (55 + DDD + número). O instalador do Android já preenche.
2. Rode `npm start`. Em alguns segundos aparece **CÓDIGO PARA CONECTAR: XXXX-XXXX**.
3. No WhatsApp Business do robô: **⋮ (três pontinhos)** → **Dispositivos conectados** → **Conectar dispositivo** → **Conectar com número de telefone** → digite o código. No iPhone, o caminho começa em **Configurações** → **Dispositivos conectados**.
4. Você tem cerca de **1 minuto** antes de o código vencer. Se vencer, pare com Ctrl + C e rode `npm start` de novo.
5. Quando aparecer **✅ WhatsApp conectado!**, o robô já está atendendo.

Pronto! Mande uma mensagem de outro número para testar.

---

## Passo 7 — Deixe atendendo sem parar

Depois de conectar, aperte **Ctrl + C** para parar e ligue de novo com um "gerenciador", que religa o robô sozinho se ele cair:

```
npm install -g pm2
pm2 start app.js --name robo
pm2 save
```

Comandos úteis: `pm2 logs robo` (ver o que está acontecendo), `pm2 restart robo` (reiniciar), `pm2 stop robo` (desligar).

**No Android**, rode também `termux-wake-lock` para o celular não "dormir" o robô.

- Não precisa ficar no carregador o tempo todo, mas o robô rodando gasta mais bateria. **O celular não pode desligar**, senão o robô para. Fique de olho na carga.

**No PC:** tire a suspensão em **Configurações → Sistema → Energia** (ou aperte `Win + R` e digite `ms-settings:powersleep`) e coloque "Nunca" enquanto o robô atende.

---

## Fez alguma mudança? Atualize o robô

Mudanças feitas pelo WhatsApp (mandando **atualizar** para o robô) já valem na hora, sem comando nenhum.

Se você mudar alguma coisa nos arquivos, como o `meu-negocio.txt`, o `.env`, as conversas ou o código, rode este comando para o robô passar a usar a mudança:

```
bash ~/chatbot-whatsapp/atualizar.sh
```

No Windows, dê dois cliques no arquivo `atualizar.bat` dentro da pasta do robô (ele fecha a janela do robô e abre de novo, já com as mudanças).

O comando confere a configuração, instala o que faltar, procura erros no código, roda os testes e reinicia o robô. Se encontrar algum problema, ele avisa e **não** reinicia, e o robô antigo continua funcionando.

### Quer melhorar ou adaptar o robô com uma IA?

Dá para pedir ao Claude, ao ChatGPT ou ao Gemini mudanças como "faça o robô perguntar o bairro antes de passar o frete" ou "quero que ele mande o cardápio quando pedirem". Para a IA entender o projeto:

1. Cole na conversa o conteúdo do arquivo **`PARA-IA.md`**. Ele explica para a IA onde fica cada coisa.
2. Cole também o arquivo que ela pedir para ver, como o `src/cerebro.js`.
3. Troque o arquivo pela versão que ela devolver e rode o comando de atualização.

---

## Não precisa de 24h? Atenda só no seu horário

**Jeito fácil:** coloque o horário no `.env` (exemplo: `HORARIO_ATENDIMENTO=08:00-18:00`). Fora desse horário o robô fica quieto.

Para ninguém ficar sem resposta, ligue a **mensagem de ausência do WhatsApp Business**: **Ferramentas comerciais → Mensagem de ausência → Agendar → Fora do horário comercial** (o horário comercial é definido no perfil da empresa). Ela avisa o cliente quando você volta.

**Jeito avançado (desligar de verdade e economizar bateria):**

- **PC:** no **Agendador de Tarefas** do Windows, crie uma tarefa às 8h com o comando `pm2 start robo` e outra às 18h com `pm2 stop robo`.
- **Android:** no Termux rode `pkg install -y cronie termux-services`, feche e abra o Termux, rode `sv-enable crond` e depois `crontab -e`. Cole as linhas abaixo, salve e saia:

  ```
  PATH=/data/data/com.termux/files/usr/bin
  0 8 * * * pm2 start robo
  0 18 * * * pm2 stop robo
  ```

---

## Problemas comuns

| Problema | Solução |
| --- | --- |
| "MODO DEMONSTRAÇÃO" ao ligar | A chave do Gemini não foi colocada no `.env` (Passo 4.1). |
| Erro de modelo não encontrado | Troque `GEMINI_MODELO` no `.env` por outro da [lista de modelos do Gemini](https://ai.google.dev/gemini-api/docs/models), por exemplo `gemini-2.5-flash-lite`. |
| Robô responde "muitas mensagens agora" | O limite grátis do Gemini foi atingido. Veja o seu limite em [aistudio.google.com](https://aistudio.google.com). Para nunca parar, crie uma segunda chave num projeto com cobrança ativada e coloque em `GEMINI_API_KEY_RESERVA`: ela só é usada quando a grátis falha. |
| Robô para quando a tela apaga | Bateria do Termux em "Sem restrições" e `termux-wake-lock` (Passo 7). |
| WhatsApp desconectou | Apague a pasta `bot_sessions`, rode `npm start` e digite o novo código no WhatsApp. |
| Aparece "Falta o número do robô" | Preencha `NUMERO_DO_ROBO` no `.env` e rode o comando de atualizar. |
| Travou em outro erro | Copie o erro inteiro e cole no Claude, no ChatGPT ou no Gemini (todos têm plano grátis). Se um bater o limite, continue em outro. |

---

## Privacidade

- O arquivo `.env` (sua chave) e a pasta `conversas` **não vão** para o GitHub.
- No plano gratuito do Gemini, os termos do Google permitem usar o conteúdo enviado para melhorar os produtos deles. Não coloque no `meu-negocio.txt` nada que não possa ser lido por terceiros. Detalhes nos [termos da API Gemini](https://ai.google.dev/gemini-api/terms).

---

## Para quem entende de código

- `src/cerebro.js`: decide a resposta (testável sem WhatsApp). `app.js`: liga ao WhatsApp com [BuilderBot](https://www.builderbot.app) + Baileys.
- `npm run testar` roda os testes automáticos; `atualizar.sh` valida e reinicia (veja `PARA-IA.md`).

Licença MIT. Use, adapte e venda instalações à vontade.

**Sucesso!**
