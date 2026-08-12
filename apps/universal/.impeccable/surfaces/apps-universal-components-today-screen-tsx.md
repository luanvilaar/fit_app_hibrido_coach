---
version: 1
slug: "apps-universal-components-today-screen-tsx"
primary_target: "apps/universal/components/today-screen.tsx"
related_targets: ["apps/universal/components/coach-hibrido/athlete/session-screen.tsx","apps/universal/components/coach-hibrido/athlete/block-card.tsx","apps/universal/components/coach-hibrido/athlete/week-strip.tsx","apps/universal/components/calendar-screen.tsx","apps/universal/components/athlete-shell.tsx"]
---

## FitBlock — superfícies operacionais do atleta

- **Modo:** Operate. Atletas identificam, executam e registram o treino; clareza e controles reconhecíveis vencem ornamentação.
- **Direção aprovada e implementada (redesign, substitui a Composição C):** referência estrutural — não visual/de marca — em duas capturas de um app de coaching (calendário semanal, banner de capa, card de programa com ação, aviso do coach, lista de blocos expansível com ações e CTA grande), fornecidas pelo usuário. A paleta, tipografia e vocabulário de marca permanecem os do FitBlock ("Dark Performance": grafite quase preto, roxo FitBlock como único acento, Barlow Condensed para momentos editoriais, Inter para interface/dados) — nada da marca ou fotografia do app de referência foi copiado.
- **`/app/hoje`:** `WeekStrip` (navegação semanal + pontos de sessão) → card de capa (placeholder abstrato, reservado para futura imagem do coach) com título da sessão → card de ação (status, foco/duração, CTA "Iniciar/Continuar treino", atalho para o Calendário) → recado do coach (ou próxima sessão) → checklist de blocos do dia (numerado, hairlines) → faixa de métricas → prontidão/semana lado a lado.
- **`/app/treino` (sessão):** blocos viram acordeão — um aberto por vez, cabeçalho sempre visível (ordem, nome, categoria, meta, chevron). Corpo expandido mostra o texto do treino, ações "Preparar" (vídeos dos movimentos) e "Resultados" (ranking) como toggles, log de carga e o botão "Concluir bloco". "Finalizar treino" permanece como CTA final da tela.
- **Sistema:** superfícies `surface02`/`surface03` sobre `bg`/`bgDeep`, cantos grandes (`radius.xl`/`xxl`) em vez das linhas retas da Composição C — este é o vocabulário real já em produção (`packages/design-tokens`), que diverge do canvas branco/ink documentado antes; a Composição C está descontinuada nesta superfície. Nenhuma borda colorida em cards/alerts; contagens usam o roxo de marca, nunca vermelho (reservado a erro/perigo).
- **Composição:** coluna única centralizada (max ~760px) em qualquer largura — sem o rail editorial de 3 colunas anterior. Mobile e desktop compartilham a mesma pilha de cards.
- **Inventário:** ícones — Ionicons existente; fonte de display — Barlow Condensed existente; capa — forma abstrata desenhada em View (sem fotografia); sem tabs "Comentários" (funcionalidade inexistente no produto).
- **Em aberto:** `components/calendar-screen.tsx` manteve sua grade mensal existente (não adotou o `WeekStrip`) — decisão deliberada para não duplicar navegação de calendário na mesma tela; revisar se o usuário quiser unificar depois. Validação visual ao vivo (screenshots) não foi possível neste ambiente (sem navegador automatizável); ambiente de teste com conta de atleta seedada foi deixado pronto para conferência manual.
