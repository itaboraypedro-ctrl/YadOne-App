# Yadone — Landing Page Specification
**Versão:** 1.0 | **Stack:** Next.js 16 + Tailwind + GSAP/Framer Motion

---

## Paleta e tipografia base

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0F0A` | Fundo global |
| `--surface` | `#111811` | Cards, painéis |
| `--accent` | `#4ADE80` | Verde — destaque, hover, CTA |
| `--accent-dim` | `#166534` | Verde escuro — bordas, estados |
| `--text-primary` | `#F0FDF4` | Títulos |
| `--text-secondary` | `#86EFAC` | Subtítulos |
| `--text-muted` | `#4B5563` | Labels, notas |
| `--border` | `#1F2D1F` | Divisores, cards |

**Tipografia:**
- Headlines: serif italiana pesada (ex: `Playfair Display` ou `DM Serif Display`) — grande, editorial
- Body / UI: `Inter` ou `DM Sans` — clean, legível
- Labels / caps: `Space Mono` — técnico, confiável

---

## SEÇÃO 1 — HERO
*[Já existe no Claude Design — referência mantida]*

**Efeito:** Nenhum adicional. Hero é âncora — calmo, imersivo, sem distração.
Balões do WhatsApp já animados com entrada suave (fade + translate-y) em sequência com delay.

**Nota técnica:** Nav com `backdrop-blur` ao fazer scroll. CTA com pulse suave `box-shadow` verde pulsando a cada 3s.

---

## SEÇÃO 2 — O PROBLEMA
### "Enquanto você atende, a rede grande fideliza."

**Layout:** Fundo escuro `#0A0F0A`. Título central gigante — ocupa 80vw — que ao fazer scroll **encolhe** de ~120px para ~32px e sobe para o topo como um label fixo da seção. Abaixo do título, 3 blocos de dor surgem em sequência.

**Efeito principal — Shrinking headline:**
> O título começa absurdamente grande, centralizado, quase ilegível de tão enorme. Conforme o usuário desce, ele encolhe e se posiciona no canto superior esquerdo como se virasse uma tag de seção. Isso cria o ritmo: "você viu o problema, agora vamos detalhar."

**Efeito secundário — Contador animado:**
Três números grandes surgem em sequência com roll-up animado:
```
56%       das farmácias independentes perderam lucro nos últimos 4 anos
5,8%      crescimento das independentes vs 13% das grandes redes
5–7x      mais caro adquirir um cliente novo do que manter um atual
```
Cada número entra com `countUp` quando entra no viewport. Cor accent verde no número, texto muted ao lado.

**3 blocos de dor** (grid 3 colunas, cada um com borda esquerda verde):
```
BLOCO 1
Título: O paciente comprou. E sumiu.
Texto: Sem follow-up, sem lembrança, sem retorno.
A próxima compra vai para quem apareceu primeiro.

BLOCO 2
Título: A rede tem CRM, app e dado.
Texto: Você tem WhatsApp e boa vontade.
Não é falta de esforço — é falta de ferramenta.

BLOCO 3
Título: Cada recompra perdida é receita invisível.
Texto: Medicamento contínuo esquecido não volta sozinho.
E você nem sabe quantos pacientes já foram.
```

**Hover nos blocos:** borda esquerda expande horizontalmente para virar borda completa do card. Background levemente mais claro.

---

## SEÇÃO 3 — BOT VS YADONE
### "Você não precisa de um bot. Você precisa de presença."

**Layout:** Fundo levemente diferenciado `#0D150D`. Comparativo visual em dois painéis lado a lado — **não uma tabela comum.** Painel esquerdo escurecido, tipografia apagada (muted). Painel direito iluminado, verde vivo.

**Efeito principal — Reveal progressivo:**
> Ao entrar na seção, o painel esquerdo (Bot genérico) aparece primeiro, já "morto" — texto cinza, ícones apagados, opacidade 60%. Conforme o scroll avança, o painel direito (Yadone) "acende" como uma tela sendo ligada: brilho sutil no border, texto brightens, ícone verde pulsa uma vez.

**Painel esquerdo — Bot genérico:**
```
Label: BOT GENÉRICO
---
Memória do paciente     Nenhuma. Cada conversa começa do zero.
Tom da conversa         Mecânico. Responde, não conversa.
Tratamento contínuo     Não acompanha. Não lembra. Não avisa.
Recompra ativa          Não existe. Espera o paciente voltar.
Vínculo com a farmácia  Nenhum. É um número, não uma relação.
```

**Painel direito — Yadone:**
```
Label: YADONE
---
Memória do paciente     Histórico completo. Sabe o nome, o tratamento, a última compra.
Tom da conversa         Fluido, humano, com a voz da sua farmácia.
Tratamento contínuo     Acompanha, lembra, avisa na hora certa — em áudio.
Recompra ativa          Antecipa. Entra em contato antes do estoque acabar.
Vínculo com a farmácia  Constrói relacionamento. Transforma cliente em paciente fiel.
```

**Frase de fechamento** (centralizada, grande, serif):
*"Bot responde. Yadone cuida."*

---

## SEÇÃO 4 — COMO FUNCIONA
### "Antes, durante e depois. O ciclo completo de cuidado."

**Layout:** Fundo `#0A0F0A`. Seção de **scrollytelling horizontal dentro de um scroll vertical.**

**Efeito principal — Sticky horizontal journey:**
> A seção fica **pinada** enquanto o usuário faz scroll. Internamente, 3 "momentos" deslizam horizontalmente da direita para a esquerda conforme o progresso do scroll. Cada momento ocupa a tela inteira. Indicador de progresso (3 pontos no rodapé da seção) atualiza em tempo real.

**Implementação sugerida:** GSAP ScrollTrigger com `pin: true` + `scrub: 1` + `horizontal: true` nos painéis internos.

---

**MOMENTO 1 — ANTES DA VENDA**
```
Label: ANTES · 01
Título: O paciente chega antes de você abrir.
Descrição:
  São 22h. Um cliente pergunta sobre dosagem de
  ibuprofeno para criança. O Yadone responde com
  precisão, anota o perfil e já sugere o produto certo
  para quando a farmácia abrir.
  Você não perdeu a venda. E ele já te conhece.

Balão de exemplo:
  [USUÁRIO] 22:14
  "Boa noite! Quanto de ibuprofeno posso dar
   para minha filha de 4 anos com febre?"

  [YADONE] 22:14
  "Oi! Para crianças de 4 anos, a dose é de
   5 a 10mg/kg a cada 6-8 horas. Posso separar
   o Ibuprofeno Infantil 100mg/mL pra você
   pegar amanhã de manhã?"

  [USUÁRIO] 22:15
  "Sim por favor! Obrigada 🙏"
```

---

**MOMENTO 2 — DURANTE A VENDA**
```
Label: DURANTE · 02
Título: A venda que você não sabia que ia acontecer.
Descrição:
  O paciente comprou o antibiótico. O Yadone percebe
  que ele vai precisar de probiótico para proteger
  a flora intestinal durante o tratamento.
  Ele sugere. O cliente agradece. O ticket médio sobe.
  Sem forçar. Sem vender. Só cuidando.

Balão de exemplo:
  [YADONE] 10:32
  "Perfeito! Seu antibiótico está separado.
   Uma dica: durante o tratamento, um probiótico
   ajuda a proteger a flora intestinal.
   Quer que eu inclua o Lactobacilos na sua compra?"

  [USUÁRIO] 10:33
  "Não sabia disso! Pode incluir sim."
```

---

**MOMENTO 3 — DEPOIS DA VENDA**
```
Label: DEPOIS · 03
Título: O lembrete que vale uma recompra.
Descrição:
  10 dias depois, o tratamento acaba.
  O Yadone envia um áudio personalizado com a voz
  da farmácia lembrando o paciente.
  Não é um spam. É o farmacêutico que você confia
  aparecendo na hora certa.

Balão de exemplo (áudio):
  [FARMÁCIA — ÁUDIO 0:12] 14:00
  🔊 "Oi Ana! Aqui é da Farmácia Central.
      Seu antibiótico acaba em 3 dias.
      Quer que a gente já separe a próxima caixa?"

  [USUÁRIO] 14:03
  "Que atencioso! Pode separar sim, obrigada 💚"
```

---

## SEÇÃO 5 — FUNCIONALIDADES
### "Cada recurso existe para uma razão: você vender mais."

**Layout:** Grid 2x3. Fundo `#0A0F0A`. Cards com borda `--border` e hover que acende o border inteiro em verde + background `--surface`.

**Efeito principal — Staggered reveal:**
> Cards entram com delay escalonado (0, 100ms, 200ms...) fazendo um efeito de onda diagonal no grid. Cada card tem um ícone minimalista que ao hover faz uma micro-animação (rotate 360 suave, ou pulse uma vez).

**Efeito secundário — Number highlight:**
> Cada card tem um número de impacto (ex: "+40% recompra") que ao hover aumenta de tamanho com um `scale(1.1)` suave.

```
CARD 1 — Lembrete de medicamento contínuo
Impacto: +40% recompra
Texto: O paciente não esquece de repor.
Você não perde a venda para o concorrente.

CARD 2 — Áudio personalizado de follow-up
Impacto: 3x mais resposta que texto
Texto: A voz da sua farmácia no ouvido do cliente.
Não é bot. É presença.

CARD 3 — Atendimento 24h sem contratar
Impacto: 0 custo adicional de pessoal
Texto: Responde às 22h com a mesma qualidade
das 10h da manhã.

CARD 4 — Histórico completo de cada paciente
Impacto: 100% do contexto preservado
Texto: Sabe o que comprou, quando, quanto.
Cada conversa continua de onde parou.

CARD 5 — Recompra ativa antes do estoque acabar
Impacto: Receita previsível todo mês
Texto: Antecipa a necessidade do paciente.
Entra em contato antes dele ir para o concorrente.

CARD 6 — Campanhas de reengajamento
Impacto: Reativa clientes inativos
Texto: Paciente sumiu há 60 dias?
O Yadone vai atrás com o contexto certo.
```

---

## SEÇÃO 6 — PAINEL DE DADOS
### "O que as grandes redes sempre tiveram. Agora é seu."

**Layout:** Full-width. Fundo diferenciado `#071207` com grade verde muito sutil no background (tipo grid paper, opacity 4%). À esquerda: copy. À direita: mockup do painel animado.

**Efeito principal — Dashboard reveal:**
> O mockup do painel entra vazio e vai "carregando" os dados em tempo real conforme o scroll: gráficos crescem, números fazem roll-up, cards aparecem com fade. Simula uma dashboard sendo preenchida ao vivo.

**Efeito secundário — Parallax:**
> O mockup desce mais devagar que o texto à esquerda, criando profundidade. Sensação de que o painel flutua.

**Copy esquerda:**
```
Label: INTELIGÊNCIA DE DADOS

Título:
Decida com dados.
Não com achismo.

Subtítulo:
Você sabe quantos pacientes não voltaram
nos últimos 30 dias? Qual medicamento tem
maior abandono de tratamento? Quais horários
geram mais engajamento?
As grandes redes sabem. Agora você também sabe.
```

**4 métricas no mockup (com animação de entrada):**
```
MÉTRICA 1 — Taxa de retenção
Visual: gráfico de linha subindo
Descrição: Veja quais pacientes estão fidelizados
e quais estão em risco de ir embora.

MÉTRICA 2 — Pacientes em risco de churn
Visual: lista com indicador vermelho/amarelo/verde
Descrição: Identifique quem não compra há mais de
X dias e ative uma campanha antes de perdê-lo.

MÉTRICA 3 — Abandono de tratamento
Visual: barra horizontal por medicamento
Descrição: Descubra quais medicamentos têm maior
taxa de abandono e aja antes da segunda compra
não acontecer.

MÉTRICA 4 — Receita recuperada
Visual: número grande com seta para cima
Descrição: Quanto o Yadone gerou em recompras
que não teriam acontecido sem o follow-up.
```

**Frase de fechamento** (centralizada, grande, border-top verde):
*"Farmácia independente com inteligência de rede grande."*

---

## SEÇÃO 7 — CTA FINAL
### Fechar com clareza e urgência real.

**Layout:** Fundo `#040A04` — o mais escuro da página, criando sensação de profundidade e fechamento. Elemento central: apenas texto + botão + nota. Minimalista.

**Efeito principal — Ambient glow:**
> Atrás do botão CTA, um brilho verde difuso e suave pulsa lentamente (como um sol nascendo). Não é chamativo — é premium. Implementado com `radial-gradient` animado em `@keyframes`.

**Efeito secundário — Texto que escreve sozinho:**
> O título da seção aparece sendo "digitado" com cursor piscando — efeito typewriter, mas apenas nessa seção de fechamento. Velocidade lenta, elegante.

```
Título (typewriter):
Sua farmácia começa a fidelizar
na primeira conversa.

Subtítulo:
49 mil farmácias independentes estão perdendo
pacientes para redes que investem em relacionamento.
As que estão reagindo estão reagindo agora.

CTA principal:
[ Agendar demonstração gratuita ]

Nota abaixo do botão:
Sem contrato. Sem fidelidade. 30 minutos.

Nota de contexto (menor, muted):
Projeto piloto aberto para farmácias independentes.
Vagas limitadas.
```

---

## Notas técnicas de implementação

### Bibliotecas recomendadas
```
GSAP + ScrollTrigger   — seção 4 (sticky horizontal), seção 2 (shrinking title)
Framer Motion          — reveals, stagger, hover nos cards
CountUp.js             — números animados na seção 2
Typewriter-effect      — seção 7
```

### Performance
- Lazy load em todos os elementos abaixo do fold
- `will-change: transform` apenas nos elementos com parallax ativo
- Desabilitar animações complexas em `prefers-reduced-motion`
- Mockup da seção 6 em SVG animado (não canvas) para performance mobile

### Mobile
- Seção 4 (horizontal sticky): em mobile vira scroll vertical normal com os 3 momentos empilhados
- Counters e parallax mantidos com intensidade reduzida
- Todos os hover states têm equivalente de tap no mobile

### Ordem de implementação sugerida para Claude Code
1. Estrutura estática de todas as seções (sem animação)
2. Copy e layout final
3. Animações de entrada (Framer Motion — as mais simples)
4. GSAP ScrollTrigger — seção 2 e 4
5. Efeitos de hover
6. Polimento: ambient glow, typewriter, mobile adjustments
