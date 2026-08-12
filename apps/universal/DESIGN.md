---
name: FitBlock
description: Catálogo operacional de performance para atletas e coaches
colors:
  ink: "#111111"
  black: "#050506"
  canvas: "#FFFFFF"
  soft-cloud: "#F5F5F5"
  surface-muted: "#ECECF1"
  hairline: "#CACACB"
  hairline-soft: "#E5E5E5"
  charcoal: "#39393B"
  text-secondary: "#707072"
  purple: "#7132F5"
  purple-dark: "#5741D8"
  purple-light: "#C7B8FF"
  success: "#007D48"
  warning: "#D99000"
  danger: "#D92D3A"
typography:
  display:
    fontFamily: "BebasNeue"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0px"
  display-section:
    fontFamily: "BebasNeue"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0px"
  body:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  none: "0px"
  card: "10px"
  search-pill: "24px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  8: "48px"
  9: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  operational-surface:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.5}"
  card-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.5}"
  card-fill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.card}"
    padding: "{spacing.5}"
---

# Design System: FitBlock

## Overview

**Creative North Star: "Catálogo de Performance"**

FitBlock é uma interface operacional de treino: uma página deve parecer uma folha de programa de alto desempenho, não uma coleção de cartões genéricos. A hierarquia é construída por contraste extremo, títulos editoriais e dados alinhados em regras finas. O atleta vê o treino, inicia a sessão e registra contexto sem procurar por uma ação entre ornamentos.

O ponto de partida foi a disciplina tipográfica e monocromática analisada em `DESIGN-nike.md`, mas o resultado é identidade própria de FitBlock: sem logotipos, slogans, fotografia, nomes de produtos, copy ou elementos proprietários da Nike. O roxo FitBlock identifica uma decisão, seleção ou progresso dentro desse sistema — nunca uma decoração espalhada pela tela.

**Key Characteristics:**

- Títulos de sessão grandes e secos; interface e dados silenciosos.
- Canvas branco, superfícies planas e hairlines de 1 px em vez de sombras ou bento cards.
- Ação principal de alto contraste, visível já na primeira dobra.
- Densidade controlada: conteúdo em linhas escaneáveis, não em painéis empilhados.
- Uma experiência compartilhada entre web, iOS e Android, com prioridade para operação móvel.

## Colors

O cromatismo é deliberadamente escasso: preto, branco e cinza sustentam a operação; roxo é sinal de estado e semânticos explicam resultado.

### Primary

- **Ink** (`#111111`): títulos, texto de maior ênfase, bordas de alta prioridade e CTAs escuros.
- **FitBlock Purple** (`#7132F5`): seleção, progresso, foco e ação ativa. Deve permanecer raro em uma tela.
- **FitBlock Purple Dark** (`#5741D8`): estado pressionado ou variação escura do roxo, não um segundo acento decorativo.

### Neutral

- **Canvas** (`#FFFFFF`): plano principal de leitura e conteúdo.
- **Soft Cloud** (`#F5F5F5`): campos de apoio, estados secundários e separação tonal discreta.
- **Surface Muted** (`#ECECF1`): suporte contextual, nunca uma camada elevada.
- **Hairline** (`#CACACB`) e **Hairline Soft** (`#E5E5E5`): regras e divisões de 1 px.
- **Charcoal** (`#39393B`) e **Text Secondary** (`#707072`): leitura secundária com contraste AA sobre canvas e Soft Cloud.

### Semantic

- **Success** (`#007D48`), **Warning** (`#D99000`) e **Danger** (`#D92D3A`): apenas para estados compreensíveis acompanhados de texto e, quando necessário, ícone.

**The One Accent Rule.** Fora de estados semânticos, somente o roxo FitBlock pode ser cromático. Sua raridade torna seleção e progresso inequívocos.

## Typography

**Display Font:** Bebas Neue (`BebasNeue`)

**Body Font:** System

**Label/Mono Font:** System; `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` somente em colunas ou dados que precisam alinhar.

**Character:** A voz editorial anuncia a sessão; a voz de sistema executa o trabalho. Não há um meio-termo decorativo entre as duas.

### Hierarchy

- **Display Hero** (400, 56 px, 0.9): título de tela e nome da sessão na primeira dobra. Em caixa alta quando o conteúdo permitir.
- **Display Section** (400, 40 px, 0.95): seções operacionais importantes. Não adicionar eyebrow decorativo antes dele.
- **Heading** (600, 24–32 px, 1.2–1.3): títulos que exigem leitura mais convencional, em especial formulários e configuração.
- **Body** (400, 16 px, 1.5): instruções, descrição de exercício, dados e inputs.
- **Label** (500, 12–14 px, 1.5): metadados, rótulos e contexto; deve manter contraste AA.

**The Two Voices Rule.** Bebas Neue é reservado ao momento editorial — título de página, sessão ou seção. Rótulos, números de formulário e instruções permanecem em System para legibilidade e localização.

## Layout

O ritmo parte de uma grade de 4 px, com 8 px como unidade recorrente. Espaçamentos usuais são 4, 8, 12, 16, 24, 32, 48 e 64 px. A página organiza uma intenção clara, ação primária e dados de treino no mesmo campo visual, com seção marcada por espaço e regra, não por um novo cartão.

Na primeira dobra desktop, o título ou nome da sessão e a ação principal convivem lado a lado; a sessão de maior prioridade ocupa o contraste escuro. Em mobile (320–639 px), a composição empilha em uma única coluna sem esconder a CTA ou o primeiro bloco. Tablet e desktop preservam a leitura alinhada sem criar densidade excessiva ou overflow horizontal.

**The Editorial Rail Rule.** Em desktop, a shell do atleta pode manter um rail editorial preto permanente à esquerda do canvas branco — especialmente na composição C de Hoje — com wordmark FitBlock, navegação inversa e marcador roxo na seção ativa. É uma moldura local da shell, não um tema escuro global.

Todos os controles acionáveis têm área mínima de 44 × 44 px. Conteúdo de dados deve usar alinhamento e colunas previsíveis, com uma regra fina separando unidades, em vez de espaços visuais arbitrários.

## Elevation & Depth

FitBlock é plano por padrão. Superfícies operacionais — blocos de treino, faixas de métrica, linhas de sessão, painéis da shell — não têm sombra: a profundidade vem do contraste entre Canvas, Soft Cloud, Ink e hairlines de 1 px. Um modal pode sobrepor o conteúdo por necessidade de fluxo, mas seu painel continua reto e tonal.

**A exceção é o card.** Um card é uma unidade destacável e agrupada — painel de time, solicitação de entrada, formulário de grupo, experiência — e carrega `0 0 8px rgba(0,0,0,0.25)`. É sombra sem deslocamento: separa o card do fundo sem simular altura. Essa é a única elevação do sistema; nada mais recebe sombra.

Em Android a sombra é aproximada por `elevation`, que sempre projeta para baixo — a versão sem deslocamento não é reproduzível lá, e essa diferença é aceita.

**The Flat-By-Default Rule.** Se uma superfície operacional precisar parecer mais importante, primeiro use hierarquia, espaço e contraste. Virar card é uma decisão de agrupamento, nunca um atalho para dar ênfase.

## Shapes

Containers, listas, painéis de sessão, campos de dados e modais operacionais têm cantos retos (`0 px`). Pílulas (`999 px`) pertencem a CTAs, filtros e estados compactos. Cards usam `10 px` — um valor único, nunca dois raios de card na mesma tela. `24 px` é reservado a uma busca ou controle cuja forma realmente se beneficia de cápsula suave; raios intermediários (`6/14/20/28 px`) são legado e não devem entrar em código novo.

As bordas são hairlines de 1 px. Não usar gradientes, vidro, bordas largas, contornos duplicados ou círculos grandes como substituto de uma hierarquia clara.

## Components

### Buttons

- **Shape:** pílula (`999 px`) para CTAs; mínimo de 44 px de altura e largura útil para todos os controles.
- **Primary:** Ink sobre Canvas, texto System de peso médio. No destaque da sessão, uma CTA clara pode existir dentro de um painel Ink.
- **Secondary / Ghost:** Soft Cloud ou Canvas, Ink e regra discreta quando necessária. Nunca competir em peso com a ação principal.
- **Focus / Pressed:** foco de teclado nunca depende apenas de opacidade. Controles claros recebem borda/anel roxo FitBlock; controles preenchidos em Ink, roxo ou Danger recebem borda/anel Canvas branco. O estado pressionado reduz a ênfase sem eliminar contraste ou foco.

### Operational Surfaces

- **Character:** uma folha de treino estruturada, não um card de dashboard.
- **Corner Style:** reto (`0 px`); sem sombra.
- **Background:** Canvas no conteúdo; Soft Cloud somente para suporte contextual.
- **Border:** hairline de 1 px para dividir linhas, dados e ações adjacentes.
- **Internal Padding:** 16–32 px conforme densidade; 24 px é o padrão de blocos de conteúdo.

### Cards

- **Quando:** um agrupamento destacável do fundo — painel de time, solicitação de entrada, formulário de grupo, experiência. Conteúdo operacional dentro de uma tela não vira card.
- **Shape:** raio de `10 px`, o mesmo nas duas variantes.
- **Elevation:** `0 0 8px rgba(0,0,0,0.25)`, aproximada por `elevation` no Android.
- **Outline:** Canvas com hairline de 1 px. É o padrão; use-o salvo motivo para o contrário.
- **Fill:** Ink sem borda, para o card que precisa sair do fluxo de leitura — em geral um destino, não um dado.
- **Recorte:** quando o card recorta os filhos no raio, a sombra vive em um wrapper externo; no iOS `overflow: hidden` corta a sombra da própria view.

### Inputs / Fields

- **Style:** superfície Soft Cloud ou Canvas com hairline, cantos retos e label explícito em System.
- **Focus:** indicador roxo FitBlock de contraste alto e foco de teclado visível.
- **Validation:** texto e ícone comunicam erro, aviso ou sucesso; cor sozinha nunca é sinal suficiente.

### Lists, Blocks & Session Rows

- **Style:** número, nome, metadados e ação organizados em uma linha ou grade curta, separados por hairline.
- **State:** roxo indica item ativo, concluído ou em progresso; não colorir a lista inteira para indicar seleção.
- **Mobile:** empilhar conteúdo sem reduzir o alvo de toque, mantendo o primeiro bloco e a próxima ação próximos do título.

### Motion & Feedback

- **Motion:** transições rápidas e funcionais (até 240 ms) podem orientar avanço de check-in ou mudança de estado.
- **Reduced motion:** quando a plataforma relatar preferência reduzida, a mudança é imediata, sem deslocamento ou fade dependente de animação.
- **Feedback:** mensagem de sucesso, erro ou estado vazio deve explicar a próxima ação em texto claro.

## Do's and Don'ts

### Do:

- **Do** colocar a decisão principal do atleta na primeira dobra e dar a ela o contraste mais alto disponível.
- **Do** usar Bebas Neue apenas para títulos editoriais e nomes de sessão; deixar a interface, números e formulários em System.
- **Do** separar blocos com ritmo e hairlines de 1 px, mantendo containers planos e retos.
- **Do** manter foco visível, suporte a teclado, labels acessíveis, reduced motion e alvos de toque de pelo menos 44 × 44 px.
- **Do** usar roxo FitBlock para estado, foco, progresso ou seleção — com parcimônia.
- **Do** preservar a verdade de FitBlock: atleta, coach, treino, feedback e progresso têm prioridade sobre qualquer referência estética.

### Don't:

- **Don't** copiar marcas, produtos, slogans, fotografia, layout proprietário ou qualquer conteúdo de Nike; `DESIGN-nike.md` é referência de princípios, não um kit de UI.
- **Don't** transformar conteúdo operacional — blocos de treino, métricas, linhas de sessão — em bento cards; eles permanecem retos, planos e separados por hairline.
- **Don't** usar gradientes, glassmorphism, sombra difusa com deslocamento ou um segundo raio de card; a única elevação do sistema é `0 0 8px rgba(0,0,0,0.25)` em `10 px`.
- **Don't** adicionar eyebrows decorativos, cor de acento aleatória ou mais de um acento de marca em uma superfície.
- **Don't** ocultar CTA, primeiro bloco do treino ou estado de foco ao reorganizar a tela em mobile.
- **Don't** comunicar estado somente por cor, reduzir targets para caber conteúdo ou animar contra a preferência de movimento reduzido.
