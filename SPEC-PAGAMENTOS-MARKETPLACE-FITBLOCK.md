# SPEC — Gestão de Pagamentos do Coach + Marketplace de Treinos

**Produto:** FitBlock Training
**Tipo:** Spec-Driven Development
**Versão:** 1.0
**Status:** Pronto para implementação

---

## 1. Objetivo

Criar dois novos pilares dentro da plataforma:

1. **Painel de Gestão de Pagamentos do Coach**
   - permitir que cada coach acompanhe mensalidades e cobranças dos seus alunos;
   - identificar rapidamente alunos inadimplentes;
   - registrar pagamentos recebidos fora da plataforma;
   - perdoar cobranças quando necessário;
   - receber pagamentos online via Mercado Pago diretamente na conta do próprio coach.

2. **Marketplace de Treinos**
   - reaproveitar a aba atual **Loja**;
   - permitir a venda de programas de treino prontos;
   - preparar a arquitetura para que diferentes coaches possam publicar e vender seus próprios programas;
   - liberar automaticamente o conteúdo comprado após confirmação do pagamento.

---

# PARTE A — PAINEL DE GESTÃO DE PAGAMENTOS

## 2. Nova área: Financeiro

Adicionar ao painel do coach uma nova aba:

> **Financeiro**

A tela deve funcionar como uma central de cobrança e recebimentos.

### 2.1. Resumo financeiro

No topo da página exibir cards com:

- **Recebido no mês**
- **A receber**
- **Em atraso**
- **Quantidade de inadimplentes**
- **Recebido via Mercado Pago**
- **Recebido manualmente**

Opcional em uma segunda fase:

- previsão de receita do mês;
- ticket médio;
- percentual de inadimplência;
- comparação com o mês anterior.

---

## 3. Lista de cobranças

Abaixo dos indicadores exibir uma tabela/lista de cobranças.

### Informações mínimas

- Aluno
- Plano
- Competência
- Data de vencimento
- Valor original
- Valor pago
- Saldo pendente
- Forma de pagamento
- Status
- Data do pagamento
- Ações

### Filtros

- Todos
- Em aberto
- Vencendo
- Em atraso
- Pagos
- Pagos manualmente
- Perdoados
- Cancelados
- Período
- Plano
- Aluno

### Busca

Campo de busca por:

- nome;
- telefone;
- e-mail.

---

# 4. Status de cobrança

Usar estados financeiros explícitos.

```ts
type ChargeStatus =
  | "pending"
  | "overdue"
  | "paid"
  | "partially_paid"
  | "forgiven"
  | "cancelled";
```

### Definições

#### `pending`
Cobrança criada e ainda dentro do prazo.

#### `overdue`
Cobrança não quitada e com vencimento ultrapassado.

#### `paid`
Cobrança integralmente quitada.

#### `partially_paid`
Foi recebido apenas parte do valor.

#### `forgiven`
O coach decidiu não cobrar o saldo da dívida.

#### `cancelled`
Cobrança inválida ou cancelada por algum motivo administrativo.

---

# 5. Recebido manualmente x Perdoar dívida

Essas duas funções **não devem ser a mesma ação**.

Elas podem terminar com o aluno sem saldo pendente, porém possuem significados financeiros completamente diferentes.

---

## 5.1. Ação: Registrar recebimento manual

Usar quando o coach recebeu o dinheiro fora da plataforma.

Exemplos:

- PIX diretamente para o coach;
- dinheiro;
- transferência bancária;
- cartão em maquininha;
- outro meio externo.

### Ao clicar em `Registrar pagamento`

Abrir modal:

```text
Registrar pagamento

Valor recebido:
R$ __________

Data:
__/__/____

Forma de pagamento:
[ PIX ]
[ Dinheiro ]
[ Transferência ]
[ Cartão externo ]
[ Outro ]

Observação:
____________________

[ Confirmar recebimento ]
```

### Regra

O valor registrado deve entrar como **receita recebida**.

Se:

```text
valor recebido == saldo pendente
```

status:

```text
paid
```

Se:

```text
valor recebido < saldo pendente
```

status:

```text
partially_paid
```

### Registro interno

Criar uma transação:

```ts
{
  source: "manual",
  amount: 300,
  paymentMethod: "pix",
  receivedAt: "...",
  createdBy: coachId
}
```

---

## 5.2. Ação: Perdoar dívida

Usar quando o coach decide que determinado valor **não será mais cobrado**.

Exemplos:

- acordo com o aluno;
- cortesia;
- erro de cobrança;
- compensação;
- cancelamento excepcional;
- decisão administrativa.

### Ao clicar em `Perdoar dívida`

Exibir confirmação:

```text
Perdoar dívida

Saldo atual:
R$ 300,00

Valor a perdoar:
R$ __________

Motivo:
____________________

[ Confirmar perdão ]
```

### Regra importante

O valor perdoado:

- reduz o saldo pendente;
- não entra no faturamento;
- não entra como pagamento;
- deve ficar registrado no histórico;
- deve guardar quem realizou a ação e quando.

Se todo o saldo for perdoado:

```text
status = forgiven
```

---

## 5.3. Por que separar as duas funções

Exemplo:

Cobrança:

```text
R$ 300,00
```

### Caso A — pagamento manual

Aluno pagou R$ 300 via PIX diretamente para o coach.

Resultado:

```text
Receita: +R$ 300
Saldo: R$ 0
Status: Pago
Origem: Manual
```

### Caso B — dívida perdoada

Coach decidiu não cobrar os R$ 300.

Resultado:

```text
Receita: R$ 0
Saldo: R$ 0
Status: Perdoado
```

Se ambas fossem tratadas como a mesma função, os relatórios financeiros apresentariam faturamento incorreto.

---

# 6. Histórico da cobrança

Cada cobrança deve ter uma timeline.

Exemplo:

```text
01 ago
Cobrança criada
R$ 300,00

05 ago
Vencimento ultrapassado
Status alterado para Em atraso

08 ago
Pagamento manual registrado
PIX — R$ 200,00

08 ago
Saldo restante
R$ 100,00

10 ago
Saldo de R$ 100,00 perdoado pelo coach

Cobrança encerrada
```

Nenhuma operação financeira deve apagar o histórico anterior.

---

# 7. Modelo de dados sugerido

## `charges`

```ts
{
  id: string,
  coachId: string,
  studentId: string,
  planId: string | null,

  description: string,
  referenceMonth: string,

  originalAmount: number,
  paidAmount: number,
  forgivenAmount: number,
  outstandingAmount: number,

  dueDate: Date,

  status:
    | "pending"
    | "overdue"
    | "paid"
    | "partially_paid"
    | "forgiven"
    | "cancelled",

  createdAt: Date,
  updatedAt: Date
}
```

---

## `payment_transactions`

```ts
{
  id: string,

  chargeId: string,
  coachId: string,
  studentId: string,

  amount: number,

  source:
    | "mercado_pago"
    | "manual",

  paymentMethod:
    | "pix"
    | "credit_card"
    | "debit_card"
    | "cash"
    | "bank_transfer"
    | "external_card"
    | "other",

  providerPaymentId: string | null,

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "refunded"
    | "cancelled",

  paidAt: Date | null,

  createdBy: string | null,

  metadata: object | null,

  createdAt: Date,
  updatedAt: Date
}
```

---

## `charge_adjustments`

Usar para perdões e ajustes administrativos.

```ts
{
  id: string,

  chargeId: string,

  type:
    | "forgiveness"
    | "discount"
    | "correction",

  amount: number,

  reason: string,

  createdBy: string,

  createdAt: Date
}
```

---

# 8. Mercado Pago

## 8.1. Objetivo

Permitir que o aluno pague dentro da plataforma utilizando o **Checkout Transparente**, enquanto o coach recebe o dinheiro na própria conta Mercado Pago.

A plataforma não deve armazenar dados brutos de cartão.

---

# 9. Conectar conta Mercado Pago

Cada coach deve possuir uma configuração própria.

Na área:

> Configurações → Pagamentos

Adicionar:

```text
Mercado Pago

Receba pagamentos dos seus alunos diretamente
na sua conta Mercado Pago.

[ Conectar Mercado Pago ]
```

Após conexão:

```text
Mercado Pago conectado

Conta: coach@email.com

Status: Ativa

[ Reconectar ]
[ Desconectar ]
```

---

# 10. OAuth

Como existirão vários coaches utilizando suas próprias contas, a integração deve usar autorização individual de cada vendedor.

Fluxo:

```text
Coach
  ↓
Conectar Mercado Pago
  ↓
OAuth Mercado Pago
  ↓
Coach autoriza o FitBlock
  ↓
Backend recebe autorização
  ↓
Credenciais vinculadas ao coach
```

Nunca armazenar tokens no frontend.

Tokens devem permanecer no backend e protegidos adequadamente.

---

# 11. Checkout Transparente

Fluxo de pagamento:

```text
Aluno
  ↓
Financeiro / Minha mensalidade
  ↓
Pagar agora
  ↓
Checkout dentro do FitBlock
  ↓
Mercado Pago
  ↓
Pagamento aprovado
  ↓
Webhook
  ↓
Backend FitBlock
  ↓
Atualiza transação
  ↓
Atualiza cobrança
```

Métodos iniciais recomendados:

- PIX
- cartão de crédito

Outros métodos podem ser adicionados posteriormente.

---

# 12. Webhooks

Nunca considerar o retorno visual do checkout como única confirmação de pagamento.

O backend deve receber as notificações do provedor e reconciliar o status.

Exemplo:

```text
Mercado Pago
     ↓
Webhook
     ↓
FitBlock API
     ↓
Localiza providerPaymentId
     ↓
Consulta/valida pagamento
     ↓
Atualiza payment_transaction
     ↓
Recalcula charge
```

### Requisito

O processamento deve ser **idempotente**.

Receber duas vezes o mesmo evento não pode criar dois pagamentos.

---

# 13. Fluxo de inadimplência

Exemplo:

```text
Vencimento: 10/08

09/08
pending

10/08
pending

11/08
overdue
```

Após pagamento:

```text
overdue
   ↓
approved payment
   ↓
paid
```

---

# 14. Ações rápidas do coach

No menu `...` de cada cobrança:

```text
Ver detalhes
Registrar pagamento
Perdoar dívida
Adicionar desconto
Enviar cobrança
Copiar link de pagamento
Editar vencimento
Cancelar cobrança
```

Ações financeiras críticas devem solicitar confirmação.

---

# 15. Página do aluno

Criar:

> Minha conta → Pagamentos

Exibir:

```text
PLANO ATUAL

FitBlock Personal
R$ 300,00

Vencimento
10 de agosto

Status
Em aberto

[ PAGAR AGORA ]
```

Histórico:

```text
Agosto     R$ 300     Em aberto
Julho      R$ 300     Pago
Junho      R$ 300     Pago
```

---

# PARTE B — MARKETPLACE DE TREINOS

# 16. Objetivo

Transformar a aba atual **Loja** em uma área capaz de vender:

- produtos físicos;
- programas de treino;
- planilhas;
- desafios;
- programas de força;
- programas de corrida;
- programas de LPO;
- programas de ginástica;
- programas híbridos;
- conteúdos digitais futuros.

---

# 17. Recomendação de arquitetura

Não criar inicialmente uma segunda loja separada.

Reaproveitar:

> **Loja**

e introduzir tipos diferentes de produto.

```ts
type ProductType =
  | "physical"
  | "training_program";
```

Assim a mesma vitrine pode possuir:

```text
LOJA

[ Todos ]
[ Treinos ]
[ Roupas ]
[ Acessórios ]
```

---

# 18. Estrutura do produto de treino

```ts
{
  id: string,

  sellerCoachId: string,

  type: "training_program",

  title: string,
  slug: string,

  description: string,
  shortDescription: string,

  coverImage: string,

  price: number,

  category:
    | "strength"
    | "hybrid"
    | "running"
    | "gymnastics"
    | "weightlifting"
    | "conditioning"
    | "other",

  level:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "all",

  durationWeeks: number | null,

  status:
    | "draft"
    | "review"
    | "published"
    | "archived",

  createdAt: Date,
  updatedAt: Date
}
```

---

# 19. Produto digital x conteúdo de treino

Um programa não deve ser tratado apenas como um arquivo para download.

O ideal é que a compra gere uma permissão dentro do próprio FitBlock.

Exemplo:

```text
Compra aprovada
      ↓
purchase
      ↓
training_program_access
      ↓
Programa aparece em
Meus Treinos
```

Tabela:

```ts
{
  id: string,
  userId: string,
  programId: string,
  purchaseId: string,

  grantedAt: Date,
  revokedAt: Date | null
}
```

---

# 20. Três formas de implementar o marketplace

## OPÇÃO 1 — Loja própria FitBlock

A FitBlock é a única vendedora.

Os programas podem ser criados internamente ou cadastrados pelo administrador.

Fluxo:

```text
FitBlock
   ↓
Publica programa
   ↓
Aluno compra
   ↓
FitBlock recebe
   ↓
Programa liberado
```

### Vantagens

- implementação mais simples;
- checkout único;
- menos regras financeiras;
- ótimo para validar a venda de programas.

### Desvantagens

- ainda não é um marketplace real;
- coaches externos não recebem automaticamente.

### Indicação

Melhor opção para um MVP extremamente rápido.

---

# 21. OPÇÃO 2 — Marketplace multi-coach

Cada coach pode vender seus próprios programas.

Exemplo:

```text
Loja

Treino de LPO
por Coach A
R$ 99

Programa Híbrido
por Coach B
R$ 149
```

Cada produto possui:

```text
sellerCoachId
```

Cada coach conecta sua conta Mercado Pago.

Fluxo:

```text
Coach publica
      ↓
Admin aprova
      ↓
Produto aparece na Loja
      ↓
Cliente compra
      ↓
Mercado Pago
      ↓
Pagamento
      ↓
Coach recebe
      ↓
FitBlock libera programa
```

### Vantagens

- marketplace real;
- escalável;
- cada coach administra seus produtos;
- plataforma pode futuramente cobrar comissão.

### Desvantagens

- maior complexidade;
- onboarding financeiro do vendedor;
- regras de comissão;
- estornos;
- conciliação;
- governança de conteúdo.

---

# 22. OPÇÃO 3 — Marketplace com comissão FitBlock

É uma evolução da opção 2.

Exemplo:

```text
Programa
R$ 100

Coach:
R$ X

FitBlock:
comissão configurada

Mercado Pago:
tarifas da operação
```

A divisão deve ser feita pelo mecanismo oficial de marketplace/split do provedor.

Adicionar ao coach:

```ts
{
  marketplaceEnabled: true,
  marketplaceCommissionPercent: number
}
```

Exemplo:

```text
Comissão FitBlock
10%
```

### Importante

Evitar receber 100% na conta da FitBlock para depois repassar manualmente a vários coaches como solução definitiva.

Para um marketplace real, o ideal é utilizar uma arquitetura própria de marketplace com vendedores conectados ao provedor de pagamentos.

---

# 23. Recomendação final para o FitBlock

Implementar em duas fases.

## FASE 1

Transformar a aba **Loja** em uma loja híbrida:

```text
Loja
 ├── Treinos
 ├── Roupas
 └── Acessórios
```

Permitir inicialmente:

- programas próprios FitBlock;
- compra via Mercado Pago;
- liberação automática do treino;
- histórico de pedidos;
- `productType = training_program`.

Isso valida rapidamente a experiência.

---

## FASE 2

Ativar o verdadeiro marketplace.

Adicionar:

```text
Painel Coach
   ↓
Meus Produtos
```

O coach poderá:

- criar programa;
- editar programa;
- definir preço;
- enviar para aprovação;
- publicar;
- ver vendas;
- ver receita;
- ver alunos compradores.

E:

```text
Configurações
   ↓
Pagamentos
   ↓
Conectar Mercado Pago
```

O FitBlock passa então a utilizar o vendedor conectado em cada transação e poderá aplicar comissão de marketplace quando necessário.

---

# 24. Página `Meus Produtos`

No painel do coach:

```text
Meus Produtos

+ Novo programa

Programa Híbrido 8 Semanas
R$ 149
Publicado
32 vendas

Força para Funcional Fitness
R$ 99
Rascunho
```

Filtros:

- todos;
- publicados;
- em análise;
- rascunhos;
- arquivados.

---

# 25. Criação de programa

Wizard sugerido:

## Etapa 1 — Informações

- nome;
- descrição;
- capa;
- categoria;
- nível;
- duração.

## Etapa 2 — Conteúdo

Adicionar:

```text
Semana 1
  Dia 1
  Dia 2
  Dia 3

Semana 2
...
```

Idealmente reutilizar a estrutura de treinos que já existe na plataforma.

Não duplicar o mesmo modelo de treino em outra arquitetura.

## Etapa 3 — Comercial

- preço;
- preço promocional;
- visibilidade;
- imagem;
- descrição da oferta.

## Etapa 4 — Publicação

```text
Enviar para análise
```

---

# 26. Moderação

Antes de entrar no marketplace:

```text
draft
  ↓
review
  ↓
published
```

Admin pode:

```text
Aprovar
Solicitar alteração
Rejeitar
Despublicar
```

---

# 27. Compra

Modelo:

```ts
{
  id: string,

  buyerId: string,
  sellerCoachId: string,

  totalAmount: number,

  paymentProvider: "mercado_pago",

  providerPaymentId: string | null,

  status:
    | "pending"
    | "paid"
    | "refunded"
    | "cancelled",

  createdAt: Date,
  paidAt: Date | null
}
```

Itens:

```ts
{
  orderId: string,
  productId: string,
  quantity: number,
  unitPrice: number
}
```

---

# 28. Liberação após compra

Somente liberar o programa quando:

```text
payment.status == approved
```

Fluxo:

```text
Webhook aprovado
      ↓
order = paid
      ↓
grantProgramAccess()
      ↓
Programa aparece no perfil
```

---

# 29. Minha Biblioteca

Criar uma área:

> **Meus Treinos**

Exemplo:

```text
MEUS TREINOS

Programa Híbrido — 8 semanas
Coach Luan Vilar

[ INICIAR ]

Ginástica para Funcional Fitness
Coach X

[ CONTINUAR ]
```

---

# 30. Permissões

## Aluno

Pode:

- comprar;
- acessar programas adquiridos;
- visualizar pagamentos;
- pagar cobranças.

Não pode:

- alterar pagamentos;
- liberar programa manualmente;
- alterar preço.

## Coach

Pode:

- visualizar seus alunos;
- visualizar suas cobranças;
- registrar pagamento manual;
- perdoar dívida;
- cadastrar produtos;
- ver suas vendas.

Não pode:

- alterar dados financeiros de outro coach;
- acessar credenciais de outro vendedor.

## Admin

Pode:

- visualizar toda a operação;
- moderar produtos;
- definir regras;
- auditar ações;
- cancelar ou ajustar operações conforme permissões administrativas.

---

# 31. Auditoria

Registrar qualquer ação sensível.

```ts
{
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  previousValue: object | null,
  newValue: object | null,
  createdAt: Date
}
```

Exemplos:

```text
PAYMENT_MANUALLY_REGISTERED
DEBT_FORGIVEN
CHARGE_CANCELLED
CHARGE_DUE_DATE_CHANGED
PRODUCT_APPROVED
PRODUCT_UNPUBLISHED
```

---

# 32. Segurança

Requisitos:

- tokens do Mercado Pago somente no backend;
- nunca registrar dados completos de cartão;
- checar ownership de toda cobrança;
- checar ownership de todo produto;
- validar webhooks;
- usar idempotência nas operações de pagamento;
- manter logs de alterações financeiras;
- impedir que um coach acesse recursos de outro coach apenas alterando IDs na URL/API.

---

# 33. Endpoints sugeridos

## Financeiro

```http
GET /api/coach/finance/summary

GET /api/coach/charges
GET /api/coach/charges/:id

POST /api/coach/charges
PATCH /api/coach/charges/:id

POST /api/coach/charges/:id/manual-payment
POST /api/coach/charges/:id/forgive
POST /api/coach/charges/:id/cancel
```

---

## Mercado Pago

```http
GET /api/integrations/mercadopago/connect

GET /api/integrations/mercadopago/callback

DELETE /api/integrations/mercadopago

POST /api/payments/mercadopago/create

POST /api/webhooks/mercadopago
```

---

## Marketplace

```http
GET /api/store/products
GET /api/store/products/:slug

POST /api/coach/products
PATCH /api/coach/products/:id
DELETE /api/coach/products/:id

POST /api/coach/products/:id/submit-review

POST /api/admin/products/:id/approve
POST /api/admin/products/:id/reject

POST /api/store/checkout

GET /api/me/purchases
GET /api/me/training-programs
```

---

# 34. Componentes de interface

## Financeiro

```text
FinanceSummaryCards
FinanceFilters
ChargeTable
ChargeStatusBadge
ChargeDetailsDrawer
ManualPaymentDialog
ForgiveDebtDialog
ChargeTimeline
MercadoPagoConnectionCard
```

## Loja

```text
StoreHeader
StoreCategories
ProductCard
TrainingProgramCard
ProductDetails
Checkout
PurchaseSuccess
```

## Coach marketplace

```text
CoachProductsTable
ProductEditor
ProgramBuilder
ProductSalesDashboard
MarketplaceRevenueCard
```

---

# 35. MVP recomendado

## Sprint / Etapa 1 — Financeiro básico

Implementar:

- `charges`;
- status;
- lista de cobranças;
- filtros;
- inadimplência;
- pagamento manual;
- perdão de dívida;
- histórico.

---

## Sprint / Etapa 2 — Mercado Pago

Implementar:

- conexão da conta do coach;
- checkout transparente;
- PIX;
- cartão;
- webhooks;
- conciliação;
- atualização automática da cobrança.

---

## Sprint / Etapa 3 — Loja de treinos

Implementar:

- `productType = training_program`;
- programas próprios FitBlock;
- checkout;
- compra;
- liberação automática;
- `Meus Treinos`.

---

## Sprint / Etapa 4 — Marketplace

Implementar:

- coach como vendedor;
- `sellerCoachId`;
- painel `Meus Produtos`;
- moderação;
- conta Mercado Pago por coach;
- vendas;
- comissão/split se adotado.

---

# 36. Critérios de aceite — Financeiro

### Inadimplência

- [ ] Coach consegue ver alunos inadimplentes.
- [ ] Cobranças vencidas passam para `overdue`.
- [ ] Coach consegue filtrar somente inadimplentes.

### Pagamento manual

- [ ] Coach consegue registrar pagamento manual.
- [ ] O valor entra no total recebido.
- [ ] A origem fica identificada como manual.
- [ ] Pagamento parcial mantém saldo pendente.

### Perdão de dívida

- [ ] Coach consegue perdoar parte ou todo o saldo.
- [ ] Valor perdoado não entra como receita.
- [ ] Motivo é obrigatório.
- [ ] A ação fica registrada na auditoria.

### Mercado Pago

- [ ] Coach conecta sua própria conta.
- [ ] Aluno consegue pagar sem sair da experiência principal.
- [ ] Pagamento aprovado atualiza automaticamente a cobrança.
- [ ] Webhook duplicado não duplica receita.

---

# 37. Critérios de aceite — Marketplace

- [ ] Aba Loja suporta produtos físicos e programas.
- [ ] Produto possui `sellerCoachId`.
- [ ] Programa comprado é liberado apenas após pagamento aprovado.
- [ ] Usuário encontra o programa em `Meus Treinos`.
- [ ] Coach consegue acompanhar vendas dos próprios produtos.
- [ ] Um coach não consegue editar produto de outro.
- [ ] Produtos podem passar por aprovação administrativa.

---

# 38. Decisões recomendadas

### Decisão 1

**Pagamento manual e perdão de dívida serão funções separadas.**

Motivo:

```text
pagamento = receita
perdão = ajuste financeiro
```

---

### Decisão 2

**Usar a aba Loja existente para o marketplace.**

Não criar uma nova navegação neste momento.

Adicionar tipos e categorias de produto.

---

### Decisão 3

**Começar vendendo programas próprios e preparar o banco para multi-vendedor.**

Mesmo no MVP, incluir:

```text
sellerCoachId
```

Isso evita uma grande migração de arquitetura posteriormente.

---

### Decisão 4

**Cada coach conecta sua própria conta Mercado Pago.**

As credenciais devem estar vinculadas ao:

```text
coachId
```

---

### Decisão 5

**Liberação de programa deve ser orientada pelo pagamento confirmado no backend.**

Nunca liberar conteúdo premium apenas porque o frontend mostrou uma tela de sucesso.

---

# 39. Estrutura geral final

```text
FITBLOCK

├── Dashboard
├── Alunos
├── Treinos
├── Financeiro
│   ├── Visão geral
│   ├── Cobranças
│   ├── Inadimplentes
│   └── Histórico
│
├── Loja
│   ├── Todos
│   ├── Treinos
│   ├── Roupas
│   └── Acessórios
│
├── Meus Produtos          [Coach]
├── Minhas Vendas          [Coach]
├── Meus Treinos           [Aluno]
│
└── Configurações
    └── Pagamentos
        └── Mercado Pago
```

---

# 40. Resultado esperado

Ao final dessa implementação o FitBlock deixa de possuir apenas controle de alunos e treinos e passa a ter uma camada comercial integrada:

```text
GESTÃO DE ALUNOS
      +
GESTÃO FINANCEIRA
      +
PAGAMENTOS
      +
LOJA
      +
MARKETPLACE
      +
ENTREGA DIGITAL DE TREINOS
```

A arquitetura deve permitir começar de forma simples e crescer posteriormente para um marketplace completo sem precisar reconstruir a Loja ou o sistema financeiro.
