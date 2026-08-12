# FITBLOCK TRAINING — DARK PERFORMANCE DESIGN SPEC

> **Status:** Design System oficial para o redesign do site FitBlock Training  
> **Versão:** 1.0  
> **Direção:** Dark Performance  
> **Referências:** Training Think Tank + princípios de dark UI inspirados no Spotify  
> **Objetivo:** criar uma identidade digital premium, esportiva, tecnológica e editorial para o ecossistema FitBlock Training.

---

# 1. VISÃO DO SISTEMA

## 1.1 Conceito central

**Performance in the Dark.**

A FitBlock deve transmitir:

- performance;
- tecnologia;
- treinamento;
- comunidade;
- produto premium;
- evolução;
- confiança.

A interface será predominantemente escura, utilizando múltiplas camadas de grafite para profundidade. A fotografia será o principal elemento emocional e o roxo FitBlock será o principal elemento de identidade.

### Fórmula visual

> **Fundo escuro → fotografia forte → tipografia monumental → roxo como ponto de atenção.**

O roxo não deve dominar a interface. Quanto mais seletivo for seu uso, mais premium será sua percepção.

---

# 2. PRINCÍPIOS DE DESIGN

## 2.1 Content-first darkness

A interface deve recuar visualmente para destacar atletas, treinos, produtos, programas e experiências.

O preto não é decoração. Ele é ambiente.

## 2.2 Purple is functional

O roxo deve sinalizar:

- ações principais;
- elementos ativos;
- destaques editoriais;
- números importantes;
- links prioritários;
- estados de hover/focus;
- pequenos efeitos de luz.

Evitar usar roxo como preenchimento genérico de grandes áreas sem função clara.

## 2.3 Editorial performance

As páginas devem combinar:

- fotografia esportiva real;
- headlines grandes;
- títulos condensados;
- grids assimétricos quando apropriado;
- cards com alto impacto visual;
- linguagem curta e direta.

## 2.4 Premium, not cyberpunk

A interface pode utilizar glow, blur e gradientes, mas sempre de forma refinada.

Não usar:

- neon excessivo;
- múltiplas cores saturadas;
- bordas brilhantes em todos os elementos;
- efeitos futuristas decorativos sem função.

## 2.5 One ecosystem, multiple experiences

As áreas Training, Coach Híbrido, Loja, Programas, Camps e Conteúdo devem ter personalidade própria, mas compartilhar os mesmos tokens, tipografia, grid, motion e comportamento de componentes.

---

# 3. PALETA DE CORES

## 3.1 Backgrounds e superfícies

| Token | Hex | Uso |
|---|---:|---|
| `--fb-bg-deep` | `#050507` | Hero, áreas dramáticas, footer |
| `--fb-bg` | `#08080B` | Fundo principal |
| `--fb-surface-01` | `#101014` | Sections alternadas, containers |
| `--fb-surface-02` | `#16161D` | Cards |
| `--fb-surface-03` | `#1D1D26` | Hover, elementos elevados |
| `--fb-surface-04` | `#252530` | Inputs, controles e estados |

## 3.2 Roxo FitBlock

| Token | Hex | Uso |
|---|---:|---|
| `--fb-purple-400` | `#8A5CFF` | Hover, highlights, glow |
| `--fb-purple-500` | `#7132F5` | Cor principal FitBlock |
| `--fb-purple-600` | `#5741D8` | Gradientes e estados |
| `--fb-purple-700` | `#5B1ECF` | Pressed, profundidade |

## 3.3 Texto

| Token | Hex | Uso |
|---|---:|---|
| `--fb-text-primary` | `#F8F8FA` | Títulos, textos principais |
| `--fb-text-secondary` | `#A5A5B3` | Parágrafos |
| `--fb-text-muted` | `#747482` | Metadata, apoio |
| `--fb-white` | `#FFFFFF` | Máximo contraste |

## 3.4 Bordas

| Token | Hex | Uso |
|---|---:|---|
| `--fb-border` | `#292934` | Bordas padrão |
| `--fb-border-hover` | `#3A3A48` | Hover |
| `--fb-border-purple` | `rgba(113,50,245,.45)` | Destaque controlado |

## 3.5 Estados semânticos

| Estado | Cor sugerida |
|---|---:|
| Success | `#44D17A` |
| Warning | `#F5A524` |
| Error | `#F15B6C` |
| Info | `#5B9DF5` |

As cores semânticas nunca substituem o roxo como identidade da marca.

---

# 4. PROPORÇÃO VISUAL DE CORES

Regra orientativa:

- **75%** preto / grafite;
- **18%** branco / cinza;
- **7%** roxo.

A interface não deve parecer “um site preto com coisas roxas”.

Ela deve parecer uma marca de performance em que o roxo funciona como assinatura visual.

---

# 5. GRADIENTES E GLOW

## 5.1 Gradiente principal

```css
linear-gradient(
  135deg,
  #7132F5 0%,
  #5B1ECF 100%
)
```

## 5.2 Gradiente de overlay para fotografia

```css
linear-gradient(
  90deg,
  rgba(5,5,7,1) 0%,
  rgba(5,5,7,.94) 35%,
  rgba(5,5,7,.35) 70%,
  rgba(5,5,7,0) 100%
)
```

## 5.3 Glow premium

```css
box-shadow:
  0 0 40px rgba(113, 50, 245, 0.28);
```

O glow deve parecer luz ambiente, nunca neon exagerado.

---

# 6. TIPOGRAFIA

## 6.1 Famílias

### Display / títulos

**Barlow Condensed**

Pesos recomendados:

- 700;
- 800;
- 900.

### UI / corpo

**Inter**

Pesos recomendados:

- 400;
- 500;
- 600;
- 700.

## 6.2 Escala tipográfica

### Hero Display

Desktop:

```text
72–96px
Weight: 800–900
Line-height: 0.90–0.98
Uppercase
```

Mobile:

```text
48–64px
```

### Section Title

Desktop:

```text
48–64px
Weight: 800
Line-height: 0.95
```

Mobile:

```text
36–44px
```

### Feature Heading

```text
28–40px
Weight: 700–800
Line-height: 1.0
```

### Body Large

```text
18px
Weight: 400
Line-height: 1.55
```

### Body

```text
16px
Weight: 400
Line-height: 1.55
```

### Small / Metadata

```text
12–14px
Weight: 500–600
```

### Label

```text
12–14px
Weight: 600
Letter-spacing: .08em
Uppercase
```

---

# 7. LINGUAGEM DE HEADLINES

Títulos devem ser curtos, fortes e facilmente escaneáveis.

Preferir:

- `TREINE PARA O QUE VEM DEPOIS.`
- `TREINE COM PROPÓSITO.`
- `PROGRAMAS PARA QUEM QUER EVOLUIR.`
- `ESCOLHA COMO VOCÊ QUER TREINAR.`
- `SEU COACH. SEU MÉTODO. SEUS ATLETAS.`

Evitar títulos genéricos como:

- “Conheça nossos serviços”;
- “Nossas soluções”;
- “Veja nossos produtos”.

## 7.1 Palavra em destaque

Uma palavra ou pequeno grupo de palavras pode receber bloco roxo.

Exemplo:

```text
TREINE PARA
O QUE VEM
[DEPOIS.]
```

O bloco roxo funciona como assinatura visual editorial.

---

# 8. GRID E LAYOUT

## 8.1 Container principal

```css
max-width: 1360px;
margin-inline: auto;
```

## 8.2 Gutters

| Breakpoint | Gutter |
|---|---:|
| Desktop | `40px` |
| Laptop | `32px` |
| Tablet | `24px` |
| Mobile | `16px` |

## 8.3 Espaçamento vertical entre sections

| Breakpoint | Espaçamento |
|---|---:|
| Desktop | `112–140px` |
| Tablet | `80px` |
| Mobile | `56–64px` |

## 8.4 Grid

Base recomendada:

- 12 colunas desktop;
- 8 colunas tablet;
- 4 colunas mobile.

Usar grids assimétricos em sections editoriais quando isso reforçar hierarquia.

---

# 9. HEADER / NAVIGATION

## 9.1 Desktop

```text
Height: 80–88px
Background: rgba(8,8,11,.86)
Backdrop blur: 18–24px
```

No topo da página, o header pode iniciar transparente sobre o Hero.

Após scroll:

- ganha background escuro;
- aplica blur;
- pode receber borda inferior sutil.

## 9.2 Navegação sugerida

- TREINOS
- COACH HÍBRIDO
- PROGRAMAS
- LOJA
- CONTEÚDOS
- ENTRAR
- COMEÇAR AGORA

## 9.3 Mobile

```text
Height: 64px
```

Utilizar menu compacto e CTA principal acessível.

---

# 10. BUTTONS

## 10.1 Primary Button

```css
height: 52px;
padding: 0 24px;
border-radius: 999px;
background: #7132F5;
color: #FFFFFF;
font-size: 14px;
font-weight: 700;
letter-spacing: .04em;
text-transform: uppercase;
```

### Hover

```css
background: #8A5CFF;
transform: translateY(-2px);
box-shadow: 0 8px 30px rgba(113,50,245,.30);
```

## 10.2 Secondary Button

```css
background: #16161D;
border: 1px solid #292934;
color: #FFFFFF;
border-radius: 999px;
```

## 10.3 Ghost Button

- sem background;
- texto branco ou roxo;
- ícone/seta;
- hover com aumento sutil de contraste.

Exemplo:

`VER PROGRAMAS →`

## 10.4 Ícone circular interno

Botões principais podem receber uma seta dentro de pequeno círculo.

Exemplo:

```text
[ COMEÇAR AGORA   → ]
```

Este recurso deve ser consistente e pode se tornar assinatura da marca.

---

# 11. BORDER RADIUS

| Elemento | Radius |
|---|---:|
| Badge pequeno | `8px` |
| Input | `12px` |
| Card | `16–20px` |
| Feature Card | `24px` |
| Hero Image | `24–32px` |
| Button | `999px` |
| Avatar/Icon Button | `50%` |

Evitar excesso de curvas que façam a interface parecer um SaaS genérico.

---

# 12. CARDS

## 12.1 Default

```css
background: #16161D;
border: 1px solid #292934;
border-radius: 20px;
```

## 12.2 Hover

```css
background: #1D1D26;
border-color: rgba(113,50,245,.45);
transform: translateY(-4px);
```

## 12.3 Transition

```css
transition: 220ms cubic-bezier(.2,.8,.2,1);
```

---

# 13. FEATURE CARDS

Feature cards devem priorizar fotografia e mensagens curtas.

Estrutura recomendada:

```text
┌──────────────────────────────────────┐
│                                      │
│  PROGRAMAÇÃO                         │
│  FITBLOCK                            │
│                                      │
│  Treine com planejamento...          │
│                                      │
│  EXPLORAR PROGRAMA →                 │
│                         [ATLETA]      │
└──────────────────────────────────────┘
```

Aplicar:

- imagem full bleed;
- gradient escuro sobre a imagem;
- texto alinhado em área segura;
- CTA curto;
- pouca informação simultânea.

---

# 14. FOTOGRAFIA

## 14.1 Direção

A fotografia deve parecer editorial fitness premium.

Características:

- atletas reais;
- treino real;
- contraste alto;
- pretos profundos;
- saturação levemente reduzida;
- pele preservada;
- luz dramática;
- grão sutil;
- composição cinematográfica.

## 14.2 Evitar

- fotografia stock genérica;
- filtro roxo cobrindo toda a foto;
- iluminação neon artificial em excesso;
- fundos excessivamente coloridos;
- imagens sem contexto de treinamento.

## 14.3 Purple lighting

Quando o roxo estiver presente na fotografia, preferir luz localizada, reflexo ou glow ambiental.

---

# 15. HERO SECTION

## 15.1 Estrutura

```text
┌──────────────────────────────────────────────┐
│                                              │
│ TREINE PARA                                  │
│ O QUE VEM                                    │
│ [DEPOIS.]                    ATLETA           │
│                                              │
│ Programação para atletas...                  │
│                                              │
│ [ COMEÇAR AGORA → ]                          │
│                                              │
└──────────────────────────────────────────────┘
```

## 15.2 Regras

- atleta predominantemente à direita;
- copy à esquerda;
- dark gradient protegendo leitura;
- máximo de 2 CTAs;
- título de 2–4 linhas;
- texto de apoio curto;
- imagem deve dominar visualmente a primeira dobra.

---

# 16. PATTERN FITBLOCK

Criar pattern utilizando:

- símbolo FitBlock;
- monograma `FB`;
- elemento gráfico proprietário da marca.

## 16.1 Opacidade

```text
0.025–0.055
```

## 16.2 Uso recomendado

- Hero;
- section institucional;
- banners;
- footer;
- grandes backgrounds editoriais.

Nunca utilizar o pattern em todas as sections.

---

# 17. TRAINING / PROGRAMAS

Cards de programas devem ser altamente visuais.

Estrutura:

```text
[ FOTO ]

HYBRID
FORÇA • ENDURANCE • PERFORMANCE

FITBLOCK HYBRID
Explorar programa →
```

Recomendado:

- imagem ocupando 60–75% do card;
- gradient inferior;
- título grande;
- labels pequenas;
- CTA discreto.

---

# 18. COACH HÍBRIDO

A seção Coach Híbrido deve ter linguagem mais tecnológica.

## 18.1 Visual

- background `#101014`;
- mockup do app;
- purple glow atrás do device;
- linhas e elementos gráficos discretos;
- UI real como principal prova visual.

## 18.2 Headline sugerida

```text
SEU COACH.
SEU MÉTODO.
[SEUS ATLETAS.]
```

CTA:

`CONHECER COACH HÍBRIDO`

---

# 19. LOJA FITBLOCK

A loja deve continuar em dark mode.

## 19.1 Product Card

Conteúdo:

- foto grande do produto;
- nome;
- preço;
- badge quando necessário;
- CTA secundário.

Exemplo:

```text
[ FOTO ]

NEW
BERMUDA PERFORMANCE 01
R$ 169,90

VER PRODUTO →
```

## 19.2 Hover

Quando houver segunda imagem:

- trocar foto no hover;
- pequena escala;
- revelar CTA.

---

# 20. CAMPS / EVENTOS

Camps e eventos devem transmitir comunidade e experiência presencial.

Cards podem utilizar:

- data;
- local;
- categoria;
- foto;
- CTA;
- status de inscrição.

Estrutura sugerida:

```text
29 AGO 2026
JOÃO PESSOA • PB

FITBLOCK TRAINING CAMP

VER EVENTO →
```

---

# 21. CONTEÚDO / BLOG

Conteúdo editorial deve usar cards mais limpos.

Cada card pode conter:

- categoria;
- imagem;
- título;
- autor;
- data;
- tempo de leitura.

Evitar cards excessivamente cheios.

---

# 22. MÉTRICAS / SOCIAL PROOF

Uma section de métricas pode utilizar números grandes.

Exemplo:

```text
+10 ANOS
TREINANDO ATLETAS

XXX+
ATLETAS

XX
PROGRAMAS

01 MÉTODO
FITBLOCK
```

Regra:

- números em Barlow Condensed;
- número roxo;
- descrição branca/cinza;
- bastante espaço ao redor.

---

# 23. MOTION SYSTEM

## 23.1 Duração

| Interação | Duração |
|---|---:|
| Hover simples | `180–220ms` |
| Card | `220ms` |
| Section entrance | `350–500ms` |
| Modal / overlay | `250–350ms` |

## 23.2 Easing

```css
cubic-bezier(.2,.8,.2,1)
```

## 23.3 Comportamentos

Cards:

```text
translateY(0 → -4px)
```

Botões:

```text
translateY(0 → -2px)
```

Imagens:

```text
scale(1 → 1.025)
```

Glow:

- intensidade pode aumentar levemente no hover;
- nunca pulsar continuamente.

## 23.4 Evitar

- parallax pesado;
- scroll hijacking;
- animações longas;
- elementos flutuando sem função;
- excesso de motion simultâneo.

---

# 24. DEPTH & ELEVATION

## Level 0 — Base

```text
#050507 / #08080B
```

## Level 1 — Surface

```text
#101014
```

## Level 2 — Card

```text
#16161D
```

## Level 3 — Elevated

```text
#1D1D26
```

## Level 4 — Overlay

Usar shadow pesada e blur.

```css
box-shadow: 0 12px 40px rgba(0,0,0,.30);
```

---

# 25. FORMULÁRIOS E INPUTS

## 25.1 Input padrão

```css
background: #16161D;
border: 1px solid #292934;
color: #F8F8FA;
border-radius: 12px;
min-height: 48px;
```

## 25.2 Placeholder

```text
#747482
```

## 25.3 Focus

```css
border-color: #7132F5;
box-shadow: 0 0 0 3px rgba(113,50,245,.16);
```

---

# 26. ICONOGRAFIA

Direção:

- simples;
- geométrica;
- stroke consistente;
- preferencialmente 1.75–2px;
- branco/cinza em estado neutro;
- roxo em estado ativo.

Evitar misturar vários estilos de ícone.

---

# 27. HOME PAGE — ARQUITETURA RECOMENDADA

1. Navigation
2. Hero
3. Social proof / números
4. Escolha como você quer treinar
5. Programas FitBlock
6. Coach Híbrido
7. Por que FitBlock
8. Comunidade / atletas
9. Conteúdos
10. Loja / New Arrivals
11. Camps / eventos
12. CTA final
13. Footer

---

# 28. IDENTIDADE POR ÁREA

| Área | Ênfase principal |
|---|---|
| FitBlock Training | Atleta |
| Coach Híbrido | Tecnologia |
| Programas | Performance |
| Loja | Produto |
| Camps | Comunidade |
| Conteúdo | Educação |

Todas as áreas compartilham o mesmo sistema visual.

---

# 29. RESPONSIVE

## Breakpoints sugeridos

| Nome | Width |
|---|---:|
| Mobile Small | `< 425px` |
| Mobile | `425–576px` |
| Tablet | `576–768px` |
| Tablet Large | `768–1024px` |
| Desktop | `1024–1440px` |
| Large Desktop | `> 1440px` |

## 29.1 Estratégia

Não apenas reduzir escala.

Reestruturar:

- grids de 3–4 colunas → 2 → 1;
- hero lado a lado → composição empilhada;
- menus completos → menu mobile;
- headlines menores, mantendo impacto;
- CTAs full-width quando fizer sentido.

## 29.2 Mobile Hero

- título acima;
- texto curto;
- CTA;
- atleta ainda visível e relevante;
- evitar esconder completamente a fotografia atrás de overlays.

---

# 30. ACESSIBILIDADE

Requisitos mínimos:

- contraste WCAG AA para textos;
- foco visível em componentes interativos;
- não depender apenas de cor para estados;
- áreas clicáveis mínimas de 44×44px;
- `prefers-reduced-motion` respeitado;
- alt text em imagens relevantes;
- ordem semântica correta de headings.

---

# 31. DO'S

- usar near-black em vez de preto puro em todas as superfícies;
- criar profundidade por variação de tons;
- usar roxo para ação e identidade;
- trabalhar fotografia como elemento principal;
- usar headlines fortes e condensadas;
- manter copy curta;
- usar cards grandes quando o conteúdo for editorial;
- utilizar glow com moderação;
- manter forte contraste;
- preservar espaço para respirar.

---

# 32. DON'TS

- não transformar o site em uma interface neon;
- não usar roxo em todos os backgrounds;
- não adicionar múltiplas cores de marca;
- não usar cards excessivamente arredondados;
- não usar efeitos sem função;
- não misturar estilos de ícones;
- não usar tipografia genérica em títulos principais;
- não usar fotos fitness stock sem personalidade;
- não reproduzir literalmente Spotify ou Training Think Tank;
- não usar light mode como experiência principal do site.

---

# 33. TOKENS CSS

```css
:root {
  /* BACKGROUNDS */
  --fb-bg-deep: #050507;
  --fb-bg: #08080B;
  --fb-surface-01: #101014;
  --fb-surface-02: #16161D;
  --fb-surface-03: #1D1D26;
  --fb-surface-04: #252530;

  /* BRAND */
  --fb-purple-400: #8A5CFF;
  --fb-purple-500: #7132F5;
  --fb-purple-600: #5741D8;
  --fb-purple-700: #5B1ECF;

  /* TEXT */
  --fb-text-primary: #F8F8FA;
  --fb-text-secondary: #A5A5B3;
  --fb-text-muted: #747482;
  --fb-white: #FFFFFF;

  /* BORDER */
  --fb-border: #292934;
  --fb-border-hover: #3A3A48;

  /* SEMANTIC */
  --fb-success: #44D17A;
  --fb-warning: #F5A524;
  --fb-error: #F15B6C;
  --fb-info: #5B9DF5;

  /* RADIUS */
  --fb-radius-sm: 8px;
  --fb-radius-md: 12px;
  --fb-radius-card: 20px;
  --fb-radius-feature: 24px;
  --fb-radius-pill: 999px;

  /* SHADOW */
  --fb-shadow-card: 0 12px 40px rgba(0,0,0,.30);
  --fb-shadow-purple: 0 12px 40px rgba(113,50,245,.22);

  /* LAYOUT */
  --fb-container: 1360px;

  /* MOTION */
  --fb-ease: cubic-bezier(.2,.8,.2,1);
  --fb-duration-fast: 180ms;
  --fb-duration-base: 220ms;
  --fb-duration-slow: 450ms;
}
```

---

# 34. PROMPT BASE PARA AGENTES DE DESIGN / UI

Use o seguinte contexto ao gerar novas telas para FitBlock:

> Crie uma interface seguindo o design system **FitBlock Dark Performance**. Use fundo principal `#08080B`, superfícies entre `#101014` e `#1D1D26`, texto principal `#F8F8FA`, texto secundário `#A5A5B3` e roxo FitBlock `#7132F5` como único accent principal. O visual deve ser premium, esportivo, tecnológico e editorial. Use Barlow Condensed em headlines grandes e Inter para UI/body. Priorize fotografia fitness real, contrastada e cinematográfica. Cards usam radius de 16–24px; botões usam formato pill. O roxo deve ser seletivo, funcional e não decorativo. Evite neon, gradients excessivos, SaaS genérico e interfaces claras. A composição deve transmitir performance, confiança, comunidade e tecnologia.

---

# 35. REGRA DE DECISÃO PARA NOVAS TELAS

Antes de criar qualquer nova tela, verificar:

1. O conteúdo principal está claro em menos de 3 segundos?
2. A fotografia ou produto é o protagonista?
3. O roxo está sendo usado com intenção?
4. Existe hierarquia clara entre título, texto e CTA?
5. A interface continua legível sem o efeito de glow?
6. O componente pertence ao mesmo ecossistema FitBlock?
7. O layout continua forte em mobile?
8. Existe contraste suficiente?
9. Há elementos decorativos sem função que podem ser removidos?
10. A tela parece FitBlock mesmo sem a logo?

Se a resposta para a última pergunta for **não**, revisar a aplicação de tipografia, fotografia, contraste, geometria e roxo.

---

# 36. MANIFESTO VISUAL

A FitBlock não deve parecer apenas um site fitness escuro.

Ela deve parecer uma **plataforma de performance**.

O preto constrói o ambiente.  
As fotos contam a história.  
O branco comunica.  
O roxo identifica a FitBlock.

> **FITBLOCK DARK PERFORMANCE**  
> **BLACK × WHITE × PREMIUM PURPLE**

---

# 37. STATUS DA SPEC

Este documento passa a ser a referência visual principal para o redesign do site FitBlock Training.

Toda nova página, section ou componente deve ser validado contra esta spec antes de ser considerado consistente com a identidade.
