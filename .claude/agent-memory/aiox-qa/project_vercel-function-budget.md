---
name: vercel-function-budget
description: O deploy do fit2 roda no plano Hobby da Vercel (máx. 12 Serverless Functions); a pasta api/ na raiz é detectada em zero-config e cada arquivo elegível consome 1 slot.
metadata:
  type: project
---

O projeto Vercel do fit2 está no plano **Hobby**, com teto de **12 Serverless Functions por deployment**. Um deploy já falhou por estourar esse teto (13 arquivos elegíveis em `api/`).

Contam como função todo arquivo `.ts`/`.js` dentro de `api/` na raiz, **exceto**:
- arquivos/pastas com prefixo `_` (é o que salva `api/_lib/*`);
- o que estiver listado no `.vercelignore` da raiz.

Depois do fix de 2026-08-16 (`.vercelignore` excluindo `api/**/*.test.ts`) a contagem é **8/12** — folga de apenas 4 slots.

**Why:** o incidente não é óbvio pelo código: os `*.test.ts` ao lado dos handlers pareciam inofensivos, mas a Vercel os trata como candidatos a função. Isso não aparece em nenhum lugar do repo além do `.vercelignore`.

**How to apply:** ao revisar qualquer PR que adicione arquivo em `api/`, some ao orçamento. Se a proposta for quebrar um handler em vários arquivos irmãos, exija que os auxiliares vão para `api/_lib/` (prefixo `_`) em vez de virarem novos endpoints. Se um novo tipo de arquivo de teste entrar (`.spec.ts`, `.test.tsx`), confira se o `.vercelignore` cobre — o `testMatch` do jest (`apps/universal/jest.config.cjs`) é mais amplo que o padrão do `.vercelignore`.
