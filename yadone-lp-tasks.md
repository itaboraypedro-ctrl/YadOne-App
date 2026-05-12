# Yadone LP — Task Board por Agente
**Referência:** `yadone-lp-spec.md` (versão 1.0)
**Objetivo:** Implementar a landing page completa em Next.js 16 + Tailwind + GSAP/Framer Motion

---

## Visão geral das fases

| Fase | O que é | Agente | Input | Output |
|---|---|---|---|---|
| 1 | Estrutura estática | Claude Code | spec.md | página sem animação, com copy |
| 2 | Animações simples | Claude Code | fase 1 concluída | reveals, hovers, stagger |
| 3 | Animações avançadas | Claude Code | fase 2 concluída | GSAP, sticky, parallax |
| 4 | Revisão e QA | Você | fase 3 concluída | ajustes finais, deploy |

---

## FASE 1 — Estrutura estática + copy
**Agente:** Claude Code
**Dependência:** nenhuma
**Tempo estimado:** 1 sessão (~45 min)

### Tarefas

**T1.1 — Setup e globals**
- Instalar dependências: `framer-motion`, `gsap`, `@gsap/react`, `countup.js`, `typewriter-effect`
- Configurar fontes no `layout.tsx`: `Playfair Display` (serif), `Inter` (body), `Space Mono` (labels) via `next/font/google`
- Criar `globals.css` com tokens CSS da paleta (`--bg`, `--surface`, `--accent`, `--accent-dim`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border`)
- Criar componente `<Nav />` com logo Yadone + links + CTA `Agendar demo`

**T1.2 — Seção 1: Hero**
- Adaptar o hero existente do Claude Design para Next.js
- Estrutura: headline 3 linhas (última em itálico verde), subheadline, balões WhatsApp, card inferior esquerdo, rodapé de 3 colunas
- Copy exata definida no `spec.md` — seção 1
- Sem animações nesta fase — só estrutura e estilo

**T1.3 — Seção 2: O Problema**
- Layout: título gigante centralizado (`text-[120px]`), abaixo 3 contadores lado a lado, abaixo grid 3 colunas com cards de dor
- Copy exata: headline "Enquanto você atende, a rede grande fideliza.", 3 números (56%, 5,8%, 5–7x), 3 blocos de dor
- Placeholder estático para os contadores (sem animação ainda)
- Cards com borda esquerda verde `border-l-2 border-accent`

**T1.4 — Seção 3: Bot vs Yadone**
- Layout: dois painéis lado a lado, full height
- Painel esquerdo: `opacity-60`, texto `text-muted`, label "BOT GENÉRICO", 5 linhas comparativas
- Painel direito: texto `text-primary`, borda verde, label "YADONE", 5 linhas comparativas
- Frase de fechamento centralizada em serif grande: "Bot responde. Yadone cuida."

**T1.5 — Seção 4: Como Funciona**
- Layout: 3 painéis empilhados verticalmente (versão estática — sticky horizontal vem na fase 3)
- Cada painel: label (ANTES·01, DURANTE·02, DEPOIS·03), título, descrição, balões de WhatsApp
- Indicador de progresso: 3 pontos no rodapé, estático por ora
- Balões com estilo correto: fundo verde (enviado) e fundo cinza (recebido), horário, nome do remetente

**T1.6 — Seção 5: Funcionalidades**
- Layout: grid 2×3
- 6 cards com: label de impacto (`+40% recompra`), título, texto
- Borda `border border-[--border]`, hover `hover:border-accent hover:bg-[--surface]`
- Ícones: usar `lucide-react` — escolher ícone adequado para cada card

**T1.7 — Seção 6: Painel de Dados**
- Layout: split 50/50 — copy à esquerda, mockup à direita
- Copy: label, título "Decida com dados. Não com achismo.", subtítulo, frase de fechamento
- Mockup direito: SVG estático simulando dashboard com 4 métricas (gráfico de linha, lista, barras, número grande) — sem animação ainda
- Fundo com grid paper verde sutil: `bg-[#071207]` + `background-image: linear-gradient(...)` opacity 4%

**T1.8 — Seção 7: CTA Final**
- Layout: centralizado, minimalista, fundo `#040A04`
- Título, subtítulo, botão CTA grande, nota abaixo do botão, nota de escassez
- Placeholder para ambient glow (div posicionada, sem animação ainda)

**T1.9 — Footer**
- Links: Como funciona, Política de Privacidade (`/privacidade`), Termos (`/termos`), Exclusão de Dados (`/exclusao-de-dados`)
- Copyright: © 2026 Yadone
- Email de contato

**Critério de conclusão da Fase 1:**
- `npx tsc --noEmit` sem erros
- Página renderiza corretamente em 1440px e 390px (mobile)
- Todo o copy está no lugar
- Nenhuma animação implementada ainda

---

## FASE 2 — Animações simples (Framer Motion)
**Agente:** Claude Code
**Dependência:** Fase 1 concluída e aprovada por Pedro
**Tempo estimado:** 1 sessão (~30 min)

### Tarefas

**T2.1 — Balões do hero (Seção 1)**
- Animação de entrada em sequência com `staggerChildren`
- Cada balão: `opacity: 0, y: 10` → `opacity: 1, y: 0`
- Delay entre balões: 400ms
- Nav: `backdrop-blur` ao scroll via `useScroll` + `useTransform`
- CTA: pulse suave no `box-shadow` verde a cada 3s via `animate` com `repeat: Infinity`

**T2.2 — CountUp nos números (Seção 2)**
- Usar `countup.js` com `IntersectionObserver` para disparar quando entrar no viewport
- 56 conta de 0 a 56 em 1.5s
- 5.8 conta de 0 a 5.8 em 1.5s com 1 decimal
- Prefixo "5–7x" aparece com fade simples

**T2.3 — Cards de dor com hover (Seção 2)**
- Hover: borda esquerda expande horizontalmente via `scaleX` de 2px para border completo
- Background: `hover:bg-[#0D150D]` com transition 200ms
- Implementar com Tailwind + CSS transition (sem Framer necessário aqui)

**T2.4 — Reveal progressivo Bot vs Yadone (Seção 3)**
- Ao entrar na viewport: painel esquerdo já aparece em `opacity-60` (estado "morto")
- Painel direito: entra com `opacity: 0` → `opacity: 1` com delay de 300ms após o esquerdo
- Border do painel direito: anima de `border-[--border]` para `border-accent` com Framer
- Ícone verde: pulse uma vez ao entrar

**T2.5 — Stagger nos cards de funcionalidades (Seção 5)**
- `staggerChildren: 0.1` com delay diagonal (linha 1: 0ms/100ms, linha 2: 200ms/300ms, linha 3: 400ms/500ms)
- Cada card: `opacity: 0, y: 20` → `opacity: 1, y: 0`
- Hover no número de impacto: `scale(1.1)` suave
- Hover no ícone: `rotate(360deg)` em 500ms

**T2.6 — Dashboard fade-in (Seção 6)**
- Mockup SVG entra com `opacity: 0` → `opacity: 1` ao scroll
- Cada elemento interno do mockup (gráfico, lista, barras, número) aparece em sequência com stagger de 200ms
- Parallax: mockup desce mais devagar que o texto — `useScroll` + `useTransform` para `y` do mockup

**T2.7 — Typewriter no CTA (Seção 7)**
- Instalar e configurar `typewriter-effect`
- Titulo digitado letra a letra: "Sua farmácia começa a fidelizar\nna primeira conversa."
- Velocidade: 50ms por caractere
- Cursor: piscando suave, some após completar

**Critério de conclusão da Fase 2:**
- Todas as animações funcionam ao scroll
- Performance: sem jank (testar no Chrome DevTools Performance)
- Mobile: animações funcionam com intensidade reduzida

---

## FASE 3 — Animações avançadas (GSAP)
**Agente:** Claude Code
**Dependência:** Fase 2 concluída e aprovada por Pedro
**Tempo estimado:** 1 sessão (~45 min)
**Atenção:** Fase mais complexa — fazer uma tarefa por vez, testar antes de avançar

### Tarefas

**T3.1 — Shrinking headline (Seção 2)**
- Usar GSAP ScrollTrigger
- Estado inicial: `font-size: clamp(80px, 10vw, 120px)`, centralizado, `opacity: 1`
- Ao scroll: encolhe para `font-size: 12px`, move para `position: sticky, top: 24px, left: 24px`
- `scrub: true` para ligação direta com scroll
- Trigger: start quando o título entra no viewport, end quando os cards de dor aparecem

**T3.2 — Sticky horizontal journey (Seção 4)**
- Usar GSAP ScrollTrigger com `pin: true`
- Container externo: `height: 300vh` para dar espaço de scroll
- Container interno: `display: flex, width: 300vw` com os 3 painéis
- Animação: translação horizontal de `0` para `-200vw` conforme scroll
- `scrub: 1` para suavidade
- Indicador de progresso: 3 pontos atualizam com `onUpdate` do ScrollTrigger
- **Mobile fallback:** em telas < 768px, desabilitar sticky e mostrar empilhado vertical

**T3.3 — Ambient glow no CTA (Seção 7)**
- `radial-gradient` verde atrás do botão
- `@keyframes pulse-glow`: escala de `opacity: 0.3, scale: 1` para `opacity: 0.6, scale: 1.2` e volta
- Duração: 3s, `ease-in-out`, `infinite`
- Raio do glow: 200px de diâmetro

**Critério de conclusão da Fase 3:**
- Seção 2 shrinking headline funciona sem travar o scroll
- Seção 4 sticky horizontal funciona no desktop e degrada graciosamente no mobile
- Ambient glow sutil e não distrativo
- `prefers-reduced-motion`: todas as animações GSAP desabilitadas

---

## FASE 4 — QA e ajustes finais
**Agente:** Pedro (você)
**Dependência:** Fase 3 concluída
**Tempo estimado:** 1-2h de revisão manual

### Checklist de QA

**Visual**
- [ ] Paleta de cores consistente em todas as seções
- [ ] Tipografia correta: serif nos títulos grandes, Inter no body, Space Mono nos labels
- [ ] Espaçamentos consistentes entre seções (sugestão: `py-32` entre seções)
- [ ] Versão mobile (390px) — todas as seções legíveis e funcionais
- [ ] Versão tablet (768px) — grid 2×3 vira 2×2 ou 1×6

**Copy**
- [ ] Toda a copy está exatamente como aprovado nas sessões anteriores
- [ ] CNPJ, email e dados reais inseridos onde há placeholder
- [ ] Links do footer funcionando: `/privacidade`, `/termos`, `/exclusao-de-dados`

**Performance**
- [ ] Lighthouse score > 85 em Performance
- [ ] LCP < 2.5s
- [ ] Nenhuma fonte causando layout shift (CLS < 0.1)
- [ ] Imagens/SVGs com `lazy` loading

**Funcional**
- [ ] Botão CTA abre formulário ou redireciona para link de agendamento (Calendly ou similar)
- [ ] Nav links com scroll suave para âncoras
- [ ] `prefers-reduced-motion` desativa animações

---

## Mapa de dependências

```
T1.1 (setup)
  └── T1.2 (hero)
  └── T1.3 (seção 2 estática)
  └── T1.4 (seção 3 estática)
  └── T1.5 (seção 4 estática)
  └── T1.6 (seção 5 estática)
  └── T1.7 (seção 6 estática)
  └── T1.8 (seção 7 estática)
  └── T1.9 (footer)
        └── [aprovação Pedro]
              └── T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6 → T2.7
                    └── [aprovação Pedro]
                          └── T3.1 → T3.2 → T3.3
                                └── [aprovação Pedro]
                                      └── Fase 4 (QA)
```

---

## PROMPT PRONTO — Cole no Claude Code para iniciar a Fase 1

```
Você vai implementar a landing page do Yadone em Next.js 16 + Tailwind.
Abaixo está a especificação completa. Implemente APENAS a Fase 1
(estrutura estática, sem nenhuma animação).

---

# CONTEXTO DO PROJETO

O Yadone é um SaaS de relacionamento com pacientes via WhatsApp para
farmácias independentes brasileiras. Esta é a landing page de vendas
cujo objetivo é levar o dono de farmácia a agendar uma demonstração.

Stack: Next.js 16 App Router + Tailwind CSS + TypeScript
Arquivo principal: app/page.tsx (ou app/(marketing)/page.tsx se já houver estrutura)
Fontes: next/font/google — Playfair_Display (serif, headlines),
        Inter (body), Space_Mono (labels/caps)

---

# TOKENS DE DESIGN (adicionar em globals.css)

:root {
  --bg: #0A0F0A;
  --surface: #111811;
  --accent: #4ADE80;
  --accent-dim: #166534;
  --text-primary: #F0FDF4;
  --text-secondary: #86EFAC;
  --text-muted: #4B5563;
  --border: #1F2D1F;
}

body {
  background-color: var(--bg);
  color: var(--text-primary);
}

---

# DEPENDÊNCIAS A INSTALAR

npm install framer-motion gsap @gsap/react countup.js typewriter-effect lucide-react

---

# COMPONENTE NAV

Sticky no topo. Ao fazer scroll, adiciona backdrop-blur e border-bottom sutil.
Logo: "Yadone" em Space Mono, font-bold, cor accent.
Links: Como funciona · Diferenciais · Dados (scroll suave para âncoras das seções)
CTA: botão "● Agendar demo" — fundo accent, texto preto, rounded-full, px-5 py-2

---

# SEÇÃO 1 — HERO
[Já existe no Claude Design — adaptar para Next.js mantendo o design exato]

Se não houver o código do Claude Design disponível, criar do zero:

Layout: fundo escuro com imagem de mulher usando celular à direita.
Lado esquerdo:
  Headline (3 linhas, Playfair Display, text-6xl md:text-8xl, font-bold):
    "Atenda cada cliente"
    "como se fosse"
    "o único." ← esta linha em itálico, cor accent

  Subheadline (Inter, text-lg, text-secondary, max-w-md):
    "O Yadone acompanha cada paciente pelo WhatsApp —
     lembra o tratamento, avisa na hora certa e traz
     de volta para comprar. Sem esforço do seu time."

  Card inferior (rounded-2xl, bg-surface, border border-[--border], p-6):
    Label: "COMO FUNCIONA · 01" (Space Mono, text-xs, text-muted)
    Texto: "Do atendimento à recompra, o Yadone mantém o vínculo
            com cada cliente — com a voz e o cuidado da sua farmácia."
    Nome: "Pedro Itaboray" (font-medium)
    Cargo: "Fundador, Yadone" (text-muted, text-sm)
    Botão: "Agendar demonstração gratuita" (bg-accent, text-black, rounded-full)

Lado direito: balões do WhatsApp sobrepostos à imagem
  Balão 1 (recebido — bg branco, texto escuro):
    Remetente: "FARMÁCIA" (text-xs, text-muted)
    Texto: "Oi Ana! Faltam 3 dias pro fim do tratamento."
    Hora: 14:02

  Balão 2 (recebido):
    Texto: "Como você está se sentindo?"
    Hora: 14:02

  Balão 3 (enviado — bg accent, texto preto, self-end):
    Remetente: "VOCÊ" (text-xs)
    Texto: "Melhor, só a garganta ainda inflamada."
    Hora: 14:05

  Balão 4 (recebido):
    Remetente: "YADONE" (text-xs, text-muted)
    Texto: "Ana, que tal aquele própolis em spray que você comprou mês passado?"
    Hora: 14:05

  Balão 5 (enviado — bg accent):
    Texto: "Boa ideia! Obrigada pelo cuidado 💚"
    Hora: 14:06

Rodapé da seção (3 colunas, text-xs, text-muted, Space Mono, uppercase):
  Esquerda: "FARMÁCIAS INDEPENDENTES"
  Centro: "WHATSAPP BUSINESS API"
  Direita: "ATENDIMENTO 24H"

---

# SEÇÃO 2 — O PROBLEMA
id="problema"
Fundo: bg-[--bg]

Título (Playfair Display, text-[clamp(60px,8vw,120px)], text-center, mb-16):
  "Enquanto você atende, a rede grande fideliza."

3 contadores (flex, justify-center, gap-16, mb-24):
  Cada contador:
    Número (Space Mono, text-6xl, font-bold, text-accent): "56%"
    Texto (Inter, text-sm, text-muted, max-w-[180px], text-center):
      "das farmácias independentes perderam lucro nos últimos 4 anos"

  Números: 56% / 5,8% / 5–7x
  Textos:
    "das farmácias independentes perderam lucro nos últimos 4 anos"
    "crescimento das independentes vs 13% das grandes redes"
    "mais caro adquirir um cliente novo do que manter um atual"

3 cards de dor (grid grid-cols-1 md:grid-cols-3, gap-6):
  Cada card (border-l-2 border-accent, pl-6, py-4):
    Título (Inter, font-semibold, text-primary, mb-2): conforme spec
    Texto (Inter, text-sm, text-secondary, leading-relaxed): conforme spec

  Card 1: "O paciente comprou. E sumiu." /
          "Sem follow-up, sem lembrança, sem retorno.
           A próxima compra vai para quem apareceu primeiro."

  Card 2: "A rede tem CRM, app e dado." /
          "Você tem WhatsApp e boa vontade.
           Não é falta de esforço — é falta de ferramenta."

  Card 3: "Cada recompra perdida é receita invisível." /
          "Medicamento contínuo esquecido não volta sozinho.
           E você nem sabe quantos pacientes já foram."

---

# SEÇÃO 3 — BOT VS YADONE
id="diferenciais"
Fundo: bg-[#0D150D]
Padding: py-32

Título (Playfair Display, text-4xl md:text-6xl, text-center, mb-4):
  "Você não precisa de um bot."
Subtítulo (Inter, text-xl, text-secondary, text-center, mb-16):
  "Você precisa de presença."

Dois painéis (grid grid-cols-1 md:grid-cols-2, gap-8, max-w-5xl, mx-auto):

  PAINEL ESQUERDO (opacity-60, border border-[--border], rounded-2xl, p-8):
    Label (Space Mono, text-xs, text-muted, mb-6): "BOT GENÉRICO"
    5 linhas (cada uma: py-3, border-b border-[--border]):
      Critério (text-sm, font-medium, text-muted) + Descrição (text-sm, text-muted)
      "Memória do paciente" / "Nenhuma. Cada conversa começa do zero."
      "Tom da conversa" / "Mecânico. Responde, não conversa."
      "Tratamento contínuo" / "Não acompanha. Não lembra. Não avisa."
      "Recompra ativa" / "Não existe. Espera o paciente voltar."
      "Vínculo com a farmácia" / "Nenhum. É um número, não uma relação."

  PAINEL DIREITO (border border-accent, rounded-2xl, p-8, bg-[--surface]):
    Label (Space Mono, text-xs, text-accent, mb-6): "YADONE"
    5 linhas (cada uma: py-3, border-b border-[--accent-dim]):
      Critério (text-sm, font-medium, text-primary) + Descrição (text-sm, text-secondary)
      "Memória do paciente" / "Histórico completo. Sabe o nome, o tratamento, a última compra."
      "Tom da conversa" / "Fluido, humano, com a voz da sua farmácia."
      "Tratamento contínuo" / "Acompanha, lembra, avisa na hora certa — em áudio."
      "Recompra ativa" / "Antecipa. Entra em contato antes do estoque acabar."
      "Vínculo com a farmácia" / "Constrói relacionamento. Transforma cliente em paciente fiel."

Frase de fechamento (Playfair Display, text-4xl, text-center, mt-16, italic):
  "Bot responde. Yadone cuida."

---

# SEÇÃO 4 — COMO FUNCIONA
id="como-funciona"
Fundo: bg-[--bg]
Padding: py-32

Título (Playfair Display, text-4xl md:text-5xl, text-center, mb-4):
  "Antes, durante e depois."
Subtítulo (text-secondary, text-xl, text-center, mb-16):
  "O ciclo completo de cuidado."

3 painéis empilhados (flex flex-col, gap-24)
[NOTA: versão estática — sticky horizontal implementado na Fase 3]

Cada painel (grid grid-cols-1 md:grid-cols-2, gap-12, items-center):

  LADO ESQUERDO (copy):
    Label (Space Mono, text-xs, text-accent, mb-2): "ANTES · 01" / "DURANTE · 02" / "DEPOIS · 03"
    Título (Playfair Display, text-3xl, mb-4): conforme spec
    Descrição (Inter, text-secondary, leading-relaxed): conforme spec

  LADO DIREITO (balões WhatsApp):
    Container (bg-[--surface], rounded-2xl, p-6, border border-[--border])
    Balões com estilo WhatsApp: recebidos à esquerda (bg branco, texto escuro),
    enviados à direita (bg-accent, texto preto)
    Cada balão: rounded-2xl, px-4 py-3, text-sm, com hora abaixo em text-xs text-muted

  Painel 1 — ANTES:
    Título: "O paciente chega antes de você abrir."
    Descrição: "São 22h. Um cliente pergunta sobre dosagem de ibuprofeno para criança.
                O Yadone responde com precisão, anota o perfil e já sugere o produto
                certo para quando a farmácia abrir. Você não perdeu a venda. E ele já te conhece."
    Balões:
      [recebido] "Boa noite! Quanto de ibuprofeno posso dar para minha filha de 4 anos com febre?" 22:14
      [enviado]  "Oi! Para crianças de 4 anos, a dose é de 5 a 10mg/kg a cada 6-8 horas.
                  Posso separar o Ibuprofeno Infantil 100mg/mL pra você pegar amanhã de manhã?" 22:14
      [recebido] "Sim por favor! Obrigada 🙏" 22:15

  Painel 2 — DURANTE:
    Título: "A venda que você não sabia que ia acontecer."
    Descrição: "O paciente comprou o antibiótico. O Yadone percebe que ele vai precisar de
                probiótico para proteger a flora intestinal. Ele sugere. O cliente agradece.
                O ticket médio sobe. Sem forçar. Sem vender. Só cuidando."
    Balões:
      [enviado]  "Perfeito! Seu antibiótico está separado. Uma dica: durante o tratamento,
                  um probiótico ajuda a proteger a flora intestinal.
                  Quer que eu inclua o Lactobacilos na sua compra?" 10:32
      [recebido] "Não sabia disso! Pode incluir sim." 10:33

  Painel 3 — DEPOIS:
    Título: "O lembrete que vale uma recompra."
    Descrição: "10 dias depois, o tratamento acaba. O Yadone envia um áudio personalizado
                com a voz da farmácia lembrando o paciente. Não é um spam. É o farmacêutico
                que você confia aparecendo na hora certa."
    Balões:
      [enviado — áudio]  "🔊 Mensagem de voz · 0:12" + subtexto "(Oi Ana! Seu antibiótico
                          acaba em 3 dias. Quer que a gente já separe a próxima caixa?)" 14:00
      [recebido] "Que atencioso! Pode separar sim, obrigada 💚" 14:03

Indicador de progresso (flex, justify-center, gap-3, mt-16):
  3 círculos (w-2 h-2, rounded-full): primeiro bg-accent, demais bg-[--border]

---

# SEÇÃO 5 — FUNCIONALIDADES
id="funcionalidades"
Fundo: bg-[--bg]
Padding: py-32

Título (Playfair Display, text-4xl, text-center, mb-4):
  "Cada recurso existe para uma razão:"
Subtítulo (text-accent, text-xl, text-center, mb-16):
  "você vender mais."

Grid (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6, max-w-6xl, mx-auto):

6 cards (border border-[--border], rounded-2xl, p-8, bg-[--bg],
         hover:border-accent hover:bg-[--surface], transition-all duration-200):

  Cada card:
    Ícone (lucide-react, w-8 h-8, text-accent, mb-4): escolher adequado
    Label de impacto (Space Mono, text-sm, text-accent, font-bold, mb-2): ex "+40% recompra"
    Título (Inter, font-semibold, text-primary, text-lg, mb-2)
    Texto (Inter, text-sm, text-secondary, leading-relaxed)

  Card 1: ícone Bell / "+40% recompra"
    "Lembrete de medicamento contínuo"
    "O paciente não esquece de repor. Você não perde a venda para o concorrente."

  Card 2: ícone Mic / "3x mais resposta que texto"
    "Áudio personalizado de follow-up"
    "A voz da sua farmácia no ouvido do cliente. Não é bot. É presença."

  Card 3: ícone Clock / "0 custo adicional de pessoal"
    "Atendimento 24h sem contratar"
    "Responde às 22h com a mesma qualidade das 10h da manhã."

  Card 4: ícone History / "100% do contexto preservado"
    "Histórico completo de cada paciente"
    "Sabe o que comprou, quando, quanto. Cada conversa continua de onde parou."

  Card 5: ícone RefreshCw / "Receita previsível todo mês"
    "Recompra ativa antes do estoque acabar"
    "Antecipa a necessidade do paciente. Entra em contato antes dele ir para o concorrente."

  Card 6: ícone Users / "Reativa clientes inativos"
    "Campanhas de reengajamento"
    "Paciente sumiu há 60 dias? O Yadone vai atrás com o contexto certo."

---

# SEÇÃO 6 — PAINEL DE DADOS
id="dados"
Fundo: bg-[#071207]
Background sutil: adicionar via style inline um grid paper verde opacity-4%
  style={{ backgroundImage: 'linear-gradient(#1a2e1a 1px, transparent 1px),
           linear-gradient(90deg, #1a2e1a 1px, transparent 1px)',
           backgroundSize: '40px 40px', opacity: 0.04 }}
Padding: py-32

Layout: grid grid-cols-1 lg:grid-cols-2, gap-16, items-center, max-w-7xl, mx-auto

LADO ESQUERDO:
  Label (Space Mono, text-xs, text-accent, mb-4): "INTELIGÊNCIA DE DADOS"
  Título (Playfair Display, text-4xl md:text-5xl, mb-6):
    "Decida com dados."
    "Não com achismo."
  Subtítulo (Inter, text-secondary, leading-relaxed, mb-8):
    "Você sabe quantos pacientes não voltaram nos últimos 30 dias?
     Qual medicamento tem maior abandono de tratamento? Quais horários
     geram mais engajamento? As grandes redes sabem. Agora você também sabe."
  Frase de fechamento (border-t border-accent, pt-6, mt-8,
                       Playfair Display, text-xl, italic, text-accent):
    "Farmácia independente com inteligência de rede grande."

LADO DIREITO (mockup dashboard estático):
  Container (bg-[--surface], border border-[--border], rounded-2xl, p-6):
    Header do mockup (flex, items-center, gap-2, mb-6):
      3 círculos decorativos (w-3 h-3 rounded-full: bg-red-500, bg-yellow-500, bg-green-500)
      Texto (Space Mono, text-xs, text-muted): "yadone.app/dashboard"

    4 métricas em grid (grid grid-cols-2, gap-4):

      Métrica 1 (col-span-2, border border-[--border], rounded-xl, p-4):
        Label (Space Mono, text-xs, text-muted): "TAXA DE RETENÇÃO"
        Número grande (text-3xl, font-bold, text-accent): "78%"
        Subtexto (text-xs, text-secondary): "↑ 12% vs mês anterior"
        Gráfico placeholder (h-16, bg-gradient-to-r from-accent/20 to-accent/5,
                             rounded, mt-3) — linha ascendente SVG simples

      Métrica 2 (border border-[--border], rounded-xl, p-4):
        Label: "EM RISCO DE CHURN"
        Número: "23"
        Subtexto: "pacientes sem compra há 30+ dias"
        3 linhas de lista com dot colorido (vermelho/amarelo/verde)

      Métrica 3 (border border-[--border], rounded-xl, p-4):
        Label: "ABANDONO DE TRATAMENTO"
        Top 3 medicamentos com barra de progresso simples
        Ex: "Metformina 500mg — 34%", "Losartana 50mg — 28%", "Omeprazol — 19%"

      Métrica 4 (col-span-2, border border-accent/30, rounded-xl, p-4, bg-accent/5):
        Label (text-accent): "RECEITA RECUPERADA"
        Número grande (text-4xl, font-bold, text-accent): "R$ 4.280"
        Subtexto: "em recompras geradas pelo Yadone este mês"
        Seta para cima (lucide ArrowUp, text-accent)

---

# SEÇÃO 7 — CTA FINAL
id="agendar"
Fundo: bg-[#040A04]
Padding: py-40

Layout: flex flex-col items-center text-center, max-w-2xl, mx-auto

Placeholder de glow (posição absoluta atrás do botão — div vazia por ora):
  className="absolute inset-0 -z-10 h-32 w-64 mx-auto rounded-full
             bg-accent/20 blur-3xl" (implementar animação na Fase 2)

Título (Playfair Display, text-4xl md:text-6xl, mb-6):
  "Sua farmácia começa a fidelizar"
  "na primeira conversa."

Subtítulo (Inter, text-secondary, text-lg, leading-relaxed, mb-10):
  "49 mil farmácias independentes estão perdendo pacientes para redes
   que investem em relacionamento. As que estão reagindo estão reagindo agora."

Botão CTA (bg-accent, text-black, font-semibold, text-lg,
            px-10 py-4, rounded-full, hover:bg-white, transition-colors):
  "Agendar demonstração gratuita"

Nota abaixo do botão (Inter, text-sm, text-muted, mt-4):
  "Sem contrato. Sem fidelidade. 30 minutos."

Nota de escassez (Space Mono, text-xs, text-muted/60, mt-6):
  "Projeto piloto aberto para farmácias independentes. Vagas limitadas."

---

# FOOTER
border-t border-[--border], bg-[--bg], py-8

Flex entre:
  Esquerda: "© 2026 Yadone" (text-xs, text-muted)
  Centro: links (text-xs, text-muted, hover:text-secondary):
    Política de Privacidade · Termos de Uso · Exclusão de Dados
  Direita: email de contato (text-xs, text-muted)

---

# INSTRUÇÕES FINAIS

1. Crie um único arquivo app/page.tsx (ou adapte a estrutura existente do projeto)
2. Importe e use os componentes na ordem das seções
3. Não implemente NENHUMA animação — apenas estrutura, Tailwind e copy
4. Use `"use client"` apenas onde necessário (interatividade)
5. Ao terminar, rode `npx tsc --noEmit` e corrija todos os erros
6. Confirme que a página renderiza em 1440px e 390px sem overflow horizontal
```
