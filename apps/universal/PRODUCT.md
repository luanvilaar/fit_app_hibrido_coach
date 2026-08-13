# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

**Primary:** Atletas individuais que abrem a app para acessar, visualizar e executar seus treinos do dia. Contexto de uso é pré-treino (verificar o plano), durante-treino (seguir exercícios e blocos), e pós-treino (feedback de performance).

**Secondary:** Coaches que gerenciam múltiplos atletas, criam e editam planos de treino, e acompanham progresso. Treinadores usam a app para orquestração, criação de conteúdo e feedback.

**Tertiary:** Donos de plataforma que administram usuários, conformidade, e operações do sistema.

## Product Purpose

Fitblock é uma **plataforma de fitness que conecta atletas com coaches** através de um sistema de treinos estruturado e progressivo. A app capacita atletas a executar treinos personalizados com clareza e rastreamento, enquanto oferece aos coaches ferramentas para criar, ajustar e acompanhar a performance de seus atletas. Sucesso = atletas completam treinos com confiança e coaches conseguem personalizar de forma consistente baseado em feedback.

## Positioning

**Mecanismo único:** Personalização progressiva de treinos — a capacidade de adaptar treinos ao longo do tempo baseado em feedback e performance do atleta, criando um loop de aprendizado e melhoria contínua entre atleta e coach. Isso é diferente de apps de treino pré-gravadas (sem adaptação) e de coaching puramente assíncrono (sem estrutura de plano).

## Operating Context

- **Uso primário:** Atleta abre app antes/durante/depois de treino; executa exercícios, registra performance
- **Workflows:** Visualizar treino do dia → Iniciar sessão → Executar blocos de exercício → Registrar resultado/feedback → Coach revisa e adapta próximo treino
- **Materiais:** Vídeos de exercícios, planos de treino estruturados, dados de performance do atleta, feedback de coach
- **Ritmo:** Treinos agendados (frequência TBD por coach), feedback entre sessões, ajustes semanais/progressivos

## Capabilities and Constraints

### Confirmed Capabilities
- Atletas visualizam treino do dia (tela "Hoje")
- Blocos de exercício com descrição, duração, equipamento
- Vídeos de exercício por exercício
- Registro de performance (reps, peso, tempo, feedback)
- Coach cria, edita e deleta planos de treino
- Coach visualiza performance e feedback de atletas
- Navegação multiplataforma (iOS, Android, web) uniforme
- Autenticação com papéis de atleta, coach, dono de plataforma

### Confirmed Constraints
- **Plataforma:** Expo universal (React Native compartilhado entre iOS, Android e web) — um único codebase entrega as três. A linguagem visual é própria do FitBlock e compartilhada; não há tema nativo por OS, mas convenções de cada plataforma (navegação, safe areas, alvos de toque, leitores de tela) são respeitadas
- **Dados:** Dados de demonstração/mock inicialmente; integração com backend conforme progresso
- **Acessibilidade:** WCAG AA obrigatória em todos os surfaces (labels semânticas, foco visível, alterar motion respeitada, touch targets 44×44 px mínimo, sem overflow horizontal)
- **Responsividade:** Breakpoints conceituais: mobile 320–639 px, tablet 640–1023 px, desktop 1024 px+
- **Cobrança:** O coach controla mensalidade dentro da plataforma — plano por aluno, geração das cobranças do mês, recebimento manual e perdão de dívida. **Gateway de pagamento online está fora**: OAuth e webhook exigem endpoint server-side, e o deploy é estático (`expo export` no Vercel), sem servidor onde hospedá-lo
- **Não escopo agora:** Pagamento online (Mercado Pago), marketplace de treinos, compliance regulatória detalhada, analytics avançado

## Brand Commitments

Nenhum comprometimento visual ou de voz cristalizado agora. Fitblock começou análise visual via referência Nike (DESIGN-nike.md) mas o design visual é **greenfield**: criar nova identidade visual de zero, não adaptar Nike. O tom de comunicação será definido conforme progride.

## Evidence on Hand

1. **Referência visual (informacional):** DESIGN-nike.md mostra abordagem visual de fotografia + tipografia contrastante + paleta rigorosa, mas é análise de concorrência, não spec obrigatória
2. **Stories de desenvolvimento:** 19+ stories mapeiam funcionalidade (1.1 Shell Universal, 1.10 Workout Results, 1.16 Athlete Today Data, 1.18 Coach Team Management, etc.)
3. **Code:** `apps/universal/` é base Expo Router com estrutura de autenticação (AuthProvider, RolesProvider), rota "Hoje" de atleta, navegação inferior mobile
4. **Tipografia iniciada:** Bebas Neue incluída (`BebasNeue-Regular.ttf`) mas sem spec de quando/onde usar

## Product Principles

1. **Foco no atleta:** Cada tela prioriza o que o atleta precisa fazer agora — ver treino, executar, registrar feedback — sem distração ou complexidade desnecessária.

2. **Clareza progressiva:** Treinos começam claros e simples; complexidade cresce com personalizacao, nunca de golpe.

3. **Loop de feedback:** Coaching é um loop: atleta treina → feedback/dados → coach adapta → novo treino. Design deve tornar cada ponto do loop frictionless.

4. **Multiplataforma transparente:** iOS, Android, web parecem uma app única — mesma lógica, navegação, UX. Diferenças são respeitadas (nav iOS vs Android) mas nunca quebram expectativa.

5. **Acessibilidade não é extra:** Conformidade WCAG AA é requisito, não pós-lançamento. Cada interação é acessível desde dia 1.

## Accessibility & Inclusion

- **WCAG AA obrigatória:** Contraste, labels semânticas, foco visível no web, nomes acessíveis para todos os controles
- **Touch targets:** 44×44 px mínimo em mobile
- **Motion:** Respeitar `prefers-reduced-motion` em animações
- **Navegação:** Keyboard-navigable no web, VoiceOver/TalkBack no mobile
- **Design:** Não comunicar via cor sozinha (ex: status só em vermelho); usar ícone + texto + estilo
