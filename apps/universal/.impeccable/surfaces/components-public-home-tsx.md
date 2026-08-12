---
version: 1
slug: "components-public-home-tsx"
primary_target: "components/public-home.tsx"
related_targets: ["app/index.tsx","components/experience-card.tsx"]
---

## FitBlock — home pública (marketing)

- **Modo:** Persuade. Visitante entende o método, reconhece o programa que serve ao momento dele e entra no app ou na experiência.
- **Escopo:** só esta rota (`app/index.tsx` → `components/public-home.tsx`). O sistema operacional do app (DESIGN.md, tokens, telas de atleta/coach) não muda.
- **Direção pinada pelo usuário:** as ideias compositivas das capturas em `references/` (site de coaching fotográfico), renderizadas na paleta e na tipografia FitBlock. O vermelho da referência foi explicitamente recusado: o acento é o roxo `#7132F5`.
- **Dispositivo assinatura — o bloco sólido.** Um retângulo cheio, sem raio, que faz três trabalhos e substitui todo eyebrow da página: (1) corta o título, uma linha da frase vive dentro do bloco em tipo reverso; (2) rotula categoria sobre foto; (3) ancora a CTA, pílula com chip circular de seta. É o único lugar onde o roxo ocupa área.
- **Composição:**
  - Hero full-bleed com vídeo, sem rail lateral: título em duas linhas com a segunda dentro do bloco roxo, parágrafo, pílula clara com chip roxo + pílula fantasma. Campo de marca d'água do wordmark em ladrilho rotacionado, ~4% de opacidade, cobrindo a dobra inteira.
  - Faixa ink de disciplinas logo abaixo do hero (herda o conteúdo do antigo rail sem numeração decorativa).
  - Método: grade assimétrica fotográfica — um card largo de largura total, depois 2/3 + 1/3. Fotos reais tratadas com véu ink + tinta roxa chapada (sem gradiente decorativo).
  - Programas: painéis em soft cloud/ink com campo sólido no topo carregando o tipo do programa em tipo reverso grande. Sem foto falsa, sem visual "FB" inventado.
  - Experiências: faixa ink com ExperienceCard existente e bloco de manifesto. Sem setas de carrossel — só uma experiência publicada, e controle morto não entra.
  - Conteúdo: linhas separadas por hairline, chip roxo de categoria, título condensado, seta. Sem numeração.
  - CTA final: foto existente, título com bloco, pílula com chip.
- **Proibido nesta superfície:** eyebrow acima de título, numeração decorativa 01/02/03, vermelho, cantos arredondados em container, gradiente decorativo, sombra em superfície operacional.
- **Movimento:** um único momento autorado — o bloco sólido do hero abre em `scaleX` a partir da borda esquerda no primeiro render, com o texto já visível. Respeita reduced motion.
- **Inventário de mídia:** vídeo do hero `hero.mp4` (existente); fotos `mari-card.png`, `time-community.webp`, `dali-card.png` (existentes, usadas nos três cards do método); `tt1.png`/`tt2.png` (existentes, CTA final); marca d'água `fitblock-mark.png` em ladrilho (existente). Nenhum slot depende de asset inexistente.
- **Pendente:** geração de imagem indisponível na sessão (cota Gemini zerada, sem `OPENAI_API_KEY`). Fotografia própria a produzir depois: retrato de coach para Programas, três capas editoriais para Conteúdo, foto de camp para Experiências. Sem comps aprovados — a direção veio pinada pelo usuário e a composição foi validada por inspeção do build.
- **Armadilha conhecida:** `flex: 0` no React Native zera o `flexBasis` (não equivale ao `flex: 0 0 auto` do CSS). Dentro do ScrollView horizontal das Experiências isso colapsava os cards para a largura do padding; a largura fixa precisa vir de `flexGrow: 0 / flexShrink: 0 / flexBasis: <largura>`.
