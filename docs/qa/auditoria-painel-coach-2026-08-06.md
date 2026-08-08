# Auditoria — Painel de construir treinos (`/app/coach/calendario`)

**Data:** 2026-08-06
**Auditor:** Dex (`@dev`)
**Escopo:** funcionalidade de **publicar**, **editar** e **excluir** treinos no painel do coach.
**Base de código:** Story 1.9 (prescrição no calendário do coach) + Story 1.12 (gating de papel).

---

## Sumário executivo

O painel entrega **um terço do ciclo de vida do treino**. Publicar funciona e é transacionalmente correto, mas expõe uma fração mínima do que o backend suporta. Editar e excluir **não existem em nenhuma camada da aplicação** — nem RPC, nem repositório, nem interface —, embora o banco já tenha as policies necessárias.

Consequência operacional: um coach que erra data, título ou carga não tem como corrigir nem remover. A única saída é republicar, o que gera duplicata permanente e visível ao atleta.

| Área | Estado | Achados |
|---|---|---|
| Publicar | Funciona com limitações | 9 (2 altos, 4 médios, 3 baixos) |
| Editar | **Inexistente** | 3 (1 bloqueador, 1 alto, 1 médio) |
| Excluir | **Inexistente** | 2 (1 bloqueador, 1 médio) |
| Visão do coach | Parcial | 2 (1 alto, 1 baixo) |
| Qualidade e acessibilidade | Lacunas | 2 (1 médio, 1 baixo) |

**Total: 18 achados — 2 bloqueadores, 4 altos, 7 médios, 5 baixos.**

---

## O que está sólido

Vale registrar o que não precisa mudar:

- **Autorização em profundidade.** `create_and_apply_session_to_team` valida `is_team_coach(p_team_id)` antes de qualquer escrita; as policies de `session_instances` cobrem select/insert/update/delete por equipe; e o gate de rota da Story 1.12 impede que não-coach abra `/app/coach/*`. Nenhum achado de segurança nesta auditoria.
- **Publicação atômica.** Template, blocos, itens, prescrições, séries e instância são criados em uma única transação (`create_and_apply_session_to_team`). Falha parcial não deixa lixo.
- **Snapshot congelado.** A sessão publicada guarda seu próprio `snapshot` jsonb, então o atleta vê exatamente o que foi publicado mesmo se o template mudar depois. É a decisão certa — mas cria um requisito para a edição (ver E3).
- **Deduplicação por slug.** `create_session_template_with_content` reaproveita exercício existente pelo slug em vez de duplicar.
- **Isolamento rascunho/publicado.** `list_athlete_calendar` filtra `status = 'published'`, então rascunho nunca vaza para o atleta.

---

## Achados — Publicar

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| **P1** | Alto | Exercício é campo de texto livre. Cada grafia diferente vira registro novo em `exercises` via `slugify`. "Back Squat", "Back squats" e "back  squat" geram três exercícios distintos, sem revisão nem limpeza | `apps/universal/data/coach-calendar.ts:129`, `supabase/migrations/20260805120000_coach_training_flow.sql:296-308` |
| **P2** | Alto | Nada impede duas sessões na mesma equipe e data. Não há constraint única nem aviso na UI — só um índice não exclusivo | `supabase/migrations/20260805120000_coach_training_flow.sql:113` |
| **P3** | Médio | Formulário fixo em 1 bloco, 1 exercício e séries clonadas idênticas, enquanto o backend aceita N blocos, N itens, séries individuais e 7 tipos de prescrição (`sets-reps`, `timed`, `amrap`, `emom`, `for-time`, `intervals`, `qualitative`) | `apps/universal/data/coach-calendar.ts:134`, `apps/universal/components/coach-calendar-screen.tsx:196-273` |
| **P4** | Médio | `status` fixo em `"published"`. Não há rascunho na interface apesar de o schema e as policies suportarem | `apps/universal/data/coach-calendar.ts:122` |
| **P5** | Médio | O formulário não reseta após publicar. Um segundo clique republica a mesma sessão sem qualquer aviso — caminho direto para o cenário de P2 | `apps/universal/components/coach-calendar-screen.tsx:96-104` |
| **P6** | Médio | Data inicial calculada com `toISOString()` (UTC). Em UTC-3, usar o painel à noite sugere D+2 em vez de amanhã. `toCalendarDate` já faz isso corretamente com getters locais | `apps/universal/data/coach-calendar.ts:81` vs `apps/universal/data/calendar.ts:33` |
| **P7** | Baixo | Publicar para outro mês some da visão: o calendário não acompanha a data salva, então o coach não vê o que acabou de criar | `apps/universal/components/coach-calendar-screen.tsx:97` |
| **P8** | Baixo | Data digitada à mão no formato `AAAA-MM-DD`, sem seletor. Aceita data passada sem aviso | `apps/universal/components/coach-calendar-screen.tsx:182-191` |
| **P9** | Baixo | Mensagens cruas do Postgres chegam ao coach (ex.: `permission denied for function ...`) | `packages/backend/src/coach-flow-repository.ts:177` |

---

## Achados — Editar

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| **E1** | **Bloqueador** | Não existe nenhum caminho de edição. As RPCs disponíveis são apenas `list_coach_teams`, `list_coach_calendar`, `create_and_apply_session_to_team`, `create_session_template_with_content`, `apply_session_template_to_team`. Nenhum método de update no repositório, nenhuma interface | `packages/backend/src/coach-flow-repository.ts` (arquivo inteiro) |
| **E2** | Alto | As sessões no calendário e na lista "SESSÕES DO PERÍODO" são `View`, não `Pressable`. Não existe sequer ponto de entrada para abrir uma sessão | `apps/universal/components/coach-calendar-screen.tsx:307-339` |
| **E3** | Médio | O `snapshot` da instância é congelado na publicação. Editar o template **não** altera a sessão já publicada — qualquer implementação de edição precisa regravar o snapshot da instância, não só o template | `supabase/migrations/20260805120000_coach_training_flow.sql:478-497` |

---

## Achados — Excluir

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| **X1** | **Bloqueador** | Não há exclusão na aplicação, apesar de a policy `"team coaches can delete session instances"` já autorizar no banco. A capacidade existe e está inacessível | `supabase/migrations/20260805120000_coach_training_flow.sql:638-640` |
| **X2** | Médio | Sem exclusão, sessão errada ou duplicada permanece visível ao atleta indefinidamente | consequência de X1 |

**Verificação de segurança da exclusão:** nenhuma tabela referencia `session_instances`. Os resultados de treino da Story 1.10 ainda são estado local em `apps/universal/data/workout-session.ts` e não persistem no banco. Excluir uma sessão hoje não causa perda de dados de atleta. Atenção: `session_instances.template_id` é `on delete restrict`, então a ordem obrigatória é apagar a instância e só depois o template órfão.

---

## Achados — Visão do coach

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| **V1** | Alto | Cada célula do calendário renderiza apenas `day.sessions[0]`. Havendo duas ou mais sessões no dia, as demais são invisíveis — inclusive as duplicatas geradas por P2/P5 | `apps/universal/components/coach-calendar-screen.tsx:308` |
| **V2** | Baixo | A lista corta em 5 sessões sem "ver todas" nem indicação de que há mais | `apps/universal/components/coach-calendar-screen.tsx:327` |

V1 agrava P2 e P5: as duplicatas existem, o atleta as vê, e o coach não.

---

## Achados — Qualidade e acessibilidade

| # | Severidade | Achado | Evidência |
|---|---|---|---|
| **Q1** | Médio | A tela não tem nenhum teste. A cobertura existente alcança só o builder de payload (`data/coach-calendar.test.ts`) e o repositório (`data/coach-backend.test.ts`) | ausência de `apps/universal/components/coach-calendar-screen.test.tsx` |
| **Q2** | Baixo | Lista de equipes usa `accessibilityRole="radio"` sem container `radiogroup`; o botão de publicar não expõe `accessibilityState={{ disabled }}` quando desabilitado | `apps/universal/components/coach-calendar-screen.tsx:143-165, 275-288` |

---

## Plano de correção

| Achado | Fase | Tratamento |
|---|---|---|
| P3, P4, P6, P5, P7, Q2, V1 | Fase 3 — Editor de sessão completo | Modelo de formulário multi-bloco, séries individuais, seletor rascunho/publicado, data local, reset pós-publicação, mês acompanha a data salva, todas as sessões do dia visíveis |
| P9 | Fase 3 | Mapeamento amigável dos erros conhecidos do backend |
| E1, E2, E3, X1, X2 | Fase 4 — Editar e excluir | RPCs `update_session_instance` e `delete_session_instance`, sessões clicáveis, edição hidratada do snapshot, exclusão com confirmação |
| Q1 | Fases 3 e 4 | Testes de render das telas novas |
| V2 | Fase 3 | Lista completa do período |
| P8 | — | Data continua digitada; validação de formato já existe. Seletor de data fica para story futura |

### Riscos aceitos

- **P1 — exercício por texto livre.** Decisão do usuário nesta rodada: o catálogo de movimentos entra apenas no banco (com `video_url`), sem seleção no formulário. O achado permanece aberto e o catálogo fica pronto para uma story de autocomplete.
- **P2 — sessões duplicadas na mesma equipe/data.** Não será adicionada constraint única: há casos legítimos de duas sessões no mesmo dia (manhã/tarde). Com a exclusão da Fase 4, o coach passa a ter como corrigir, e com V1 resolvido passa a **enxergar** a duplicata.

---

## Referências

- Story 1.4 — backend de equipes, templates e prescrição
- Story 1.8 — leitura do calendário do atleta
- Story 1.9 — prescrição no calendário do coach (origem do painel auditado)
- Story 1.10 — resultados da sessão do atleta (ainda sem persistência)
- Story 1.12 — modelo de papéis e gating da rota do coach
