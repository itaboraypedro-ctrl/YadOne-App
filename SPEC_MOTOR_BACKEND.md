# SPEC_MOTOR_BACKEND.md
# Motor de Conversação — Workflow-Guided Proactive Agent

> **Versão:** 1.0  
> **Status:** Spec aprovado — pronto para implementação  
> **Escopo:** Backend exclusivamente. Frontend/Flow Builder é spec separado.

---

## 1. Filosofia e Princípios

### O que este motor é

Um **Workflow-Guided Proactive Agent**: a IA recebe um briefing (o fluxo criado pelo usuário), não um script. Ela entende o objetivo de cada etapa e conduz a conversa como um funcionário experiente — seguindo a intenção, não o caminho literal.

O fluxo visual criado pelo usuário humano é uma **soft guardrail**: orienta, não prende. A IA tem visão global de tudo (todos os produtos, histórico do cliente, base de conhecimento) o tempo todo, independente de qual etapa do fluxo está ativa.

### Os três princípios invioláveis

**1. Contexto global nunca some**  
Catálogo de produtos, perfil do workspace, memória do cliente e histórico da conversa estão sempre disponíveis para o LLM, independente do nó ativo.

**2. Fluxo como objetivo, não como trilho**  
Cada nó do fluxo expressa *o que se quer alcançar*, não *o que dizer palavra por palavra*. O LLM decide como chegar lá com base no contexto real da conversa.

**3. Digressão com retomada garantida**  
Quando o cliente muda de assunto, o agente acompanha naturalmente. Quando o desvio encerra, retoma o objetivo pendente sem ser robótico ou forçado.

### Por que isso é "melhor que humano"

| Capacidade | Humano | Este motor |
|---|---|---|
| Memória do cliente | Depende de anotação manual | Perfeita, automática, usada ativamente |
| Consistência de tom | Varia por humor/cansaço | 100% consistente |
| Digressão + retomada | Às vezes esquece de retomar | Garantida por arquitetura |
| Proatividade | Depende do funcionário | Comportamento esperado padrão |
| Disponibilidade | Horário comercial | 24/7 |
| Escalabilidade | 1 conversa por vez | N conversas simultâneas |

---

## 2. Arquitetura em 3 Camadas

```
┌─────────────────────────────────────────────────────────┐
│                 CAMADA 1 — CONTEXTO GLOBAL              │
│  Sempre presente. Nunca some. Alimenta todas as camadas.│
│                                                         │
│  • Perfil do workspace (persona, tom, regras)           │
│  • Catálogo completo de produtos/serviços               │
│  • Memória do cliente (resumo persistente)              │
│  • Knowledge base (filtrada por tags do nó ativo)       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  CAMADA 2 — PLANNER                     │
│  Modelo: Claude Haiku (rápido, barato)                  │
│                                                         │
│  Responsabilidades:                                     │
│  • Ler o fluxo ativo como SOP em linguagem natural      │
│  • Detectar topic shifts (cliente desviou do objetivo?) │
│  • Decidir: seguir / digressar / retomar / escalar      │
│  • Identificar oportunidades proativas                  │
│  • Determinar qual tool chamar (se houver)              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 CAMADA 3 — EXECUTOR                     │
│  Modelo: Claude Sonnet (qualidade conversacional)       │
│                                                         │
│  Responsabilidades:                                     │
│  • Gerar resposta no tom exato do workspace             │
│  • Executar tool calls (agenda, pagamento, CRM)         │
│  • Processar mídia (Whisper para áudio,                 │
│    Claude Vision para imagem/doc)                       │
│  • Atualizar estado da sessão                           │
│  • Emitir eventos para o CRM                           │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de processamento por mensagem recebida

```
Mensagem chega (texto / áudio / imagem / doc)
          │
          ▼
[PRÉ-PROCESSAMENTO]
  • Áudio? → Whisper → transcrição em texto
  • Imagem/Doc? → Claude Vision → descrição estruturada
  • Tudo vira texto antes de entrar no motor
          │
          ▼
[BUSCA DE CONTEXTO]
  • Carrega sessão ativa do cliente
  • Carrega perfil do workspace
  • Carrega memória do cliente
  • Carrega nó ativo do fluxo + knowledge tags
  • Carrega catálogo global de produtos
          │
          ▼
[PLANNER — Claude Haiku]
  • Monta o system prompt completo (ver seção 5)
  • Avalia: o cliente está no tema? Há desvio? Há oportunidade?
  • Decide a ação: respond / call_tool / digress / resume / handoff / wait
  • Retorna: { action, tool_name?, tool_params?, objective_pending? }
          │
          ▼
[EXECUTOR — Claude Sonnet]
  • Se action = respond: gera resposta conversacional
  • Se action = call_tool: executa tool → incorpora resultado → gera resposta
  • Se action = handoff: prepara transferência para humano
  • Sempre: atualiza sessão, emite eventos CRM
          │
          ▼
[PÓS-PROCESSAMENTO]
  • Salva mensagem no histórico
  • Atualiza estado da sessão (nó atual, variáveis, digressão pendente)
  • Emite eventos de CRM (ex: appointment_created, flow_completed)
  • Se wait ativo: registra timer de followup
          │
          ▼
[ENVIO]
  • Formata resposta para o canal ativo (YCloud / ZAPI / Evolution)
  • Envia
```

---

## 3. Os 5 Tipos de Nó

Todo fluxo é um grafo direcionado composto por esses 5 tipos. Nada mais.

### 3.1 `step` — Etapa conversacional

O nó principal. Representa uma etapa da conversa com um objetivo claro.

```typescript
interface StepNode {
  id: string
  type: 'step'
  config: {
    objective: string              // "Descobrir qual serviço o cliente quer"
    knowledge_tags: string[]       // Tags da base de conhecimento a consultar
    awaits_response: boolean       // true = aguarda resposta antes de avançar
    allow_digression: boolean      // true = agente pode sair do tema e retomar
    context_window: {
      include_client_memory: boolean
      message_history_limit: number  // últimas N mensagens
      include_full_catalog: boolean
    }
    llm_config: {
      model: 'claude-haiku' | 'claude-sonnet'
      temperature: number          // 0.0 a 1.0
    }
  }
  edges: FlowEdge[]
}
```

**Comportamento:**
- Sempre aceita qualquer tipo de mídia (texto, áudio, imagem, documento)
- O LLM gera a mensagem baseado no `objective`, não em texto fixo
- Se `allow_digression: true`, o Planner pode desviar e retomar

---

### 3.2 `condition` — Ramificação lógica

Ramifica o fluxo baseado em variável da sessão. **Sem LLM.**

```typescript
interface ConditionNode {
  id: string
  type: 'condition'
  config: {
    variable: string               // ex: "session.servico_escolhido"
    rules: ConditionRule[]
  }
  edges: FlowEdge[]
}

interface ConditionRule {
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'is_null' | 'regex'
  value: string
  target_node_id: string
}
```

**Comportamento:**
- Execução determinística, zero custo de LLM
- Avalia regras em ordem, usa a primeira que satisfaz
- Edge default obrigatório para quando nenhuma regra satisfaz

---

### 3.3 `tool_call` — Ação externa

Executa uma função real (API, banco de dados). Pode ter LLM para interpretar resultado e gerar resposta.

```typescript
interface ToolCallNode {
  id: string
  type: 'tool_call'
  config: {
    tool_id: string                // ex: "buscar_horarios_livres"
    param_mapping: Record<string, string>  // { "servico_id": "session.servico_id" }
    response_variable: string      // onde salvar o resultado na sessão
    generate_response: boolean     // true = LLM formata o resultado em linguagem natural
    error_node_id?: string         // nó para ir se a tool falhar
  }
  edges: FlowEdge[]
}
```

**Tools disponíveis (fase 1):**

```typescript
const AVAILABLE_TOOLS = {
  buscar_horarios_livres: {
    params: { workspace_id: string, servico_id: string, data?: string },
    returns: { slots: string[] }
  },
  criar_agendamento: {
    params: { workspace_id: string, cliente_id: string, servico_id: string, horario: string },
    returns: { agendamento_id: string, confirmacao: string }
  },
  cancelar_agendamento: {
    params: { agendamento_id: string },
    returns: { success: boolean }
  },
  buscar_historico_cliente: {
    params: { workspace_id: string, telefone: string },
    returns: { agendamentos: Agendamento[], total_visitas: number, ultimo_servico: string }
  },
  registrar_ou_atualizar_cliente: {
    params: { workspace_id: string, dados: ClienteData },
    returns: { cliente_id: string }
  }
}
// Fase 2: gerar_link_pagamento (Abacate Pay), sincronizar_agenda (Trinks), etc.
```

**Arquitetura extensível de tools:**

```typescript
interface ToolDefinition {
  id: string
  name: string
  description: string            // usado pelo Planner para decidir quando chamar
  params_schema: JSONSchema
  returns_schema: JSONSchema
  handler: (params: any, context: WorkspaceContext) => Promise<any>
  category: 'scheduling' | 'payment' | 'crm' | 'external_api'
  requires_confirmation: boolean // true = pede confirmação do usuário antes de executar
}
```

---

### 3.4 `wait` — Pausa temporizada

Pausa o fluxo por um período. Avança por timer ou por resposta do cliente.

```typescript
interface WaitNode {
  id: string
  type: 'wait'
  config: {
    duration: {
      value: number
      unit: 'minutes' | 'hours' | 'days'
    }
    advance_on_response: boolean   // true = se cliente responder antes, avança imediatamente
    timeout_node_id: string        // nó para ir quando o timer expira
    response_node_id?: string      // nó para ir se o cliente responder antes
    message_on_timeout?: string    // mensagem automática quando o timer dispara
  }
  edges: FlowEdge[]
}
```

**Caso de uso principal (followup):**
```
[Envia link de agendamento] 
        ↓
[wait: 24h, advance_on_response: true]
        ↓ (timer)                    ↓ (cliente respondeu antes)
[FUP: "Conseguiu agendar?"]     [Detecta intenção da resposta]
```

---

### 3.5 `handoff` — Transferência para humano

Encerra a automação e notifica o atendente humano.

```typescript
interface HandoffNode {
  id: string
  type: 'handoff'
  config: {
    reason: string                 // "Cliente solicitou falar com humano"
    transition_message: string     // Mensagem enviada ao cliente
    notify_channel: 'whatsapp' | 'email' | 'webhook'
    notify_target: string          // número/email/URL para notificar
    include_conversation_summary: boolean
  }
}
```

---

### Tipo compartilhado: FlowEdge

```typescript
interface FlowEdge {
  id: string
  source_node_id: string
  target_node_id: string
  label?: string                   // descrição da condição (ex: "cliente escolheu corte")
  condition?: {
    variable: string
    operator: string
    value: string
  }
  is_default: boolean              // edge padrão quando nenhuma condição satisfaz
}
```

---

## 4. Sistema de Conhecimento por Tags

### Conceito

Cada workspace tem uma base de conhecimento organizada por **tags**. Um nó `step` pode ter N tags associadas. Quando o LLM processa aquele nó, consulta o conteúdo de todas as tags associadas antes de gerar a resposta.

Isso permite:
- Reutilizar o mesmo conteúdo em múltiplos nós sem duplicar
- Isolar conhecimento por produto/serviço
- Atualizar o conhecimento sem tocar no fluxo

### Tipos de conhecimento

| Tipo | Exemplo | Como é usado |
|---|---|---|
| `text` | "Informações sobre o corte masculino..." | Injetado diretamente no contexto |
| `document` | PDF de tabela de preços | Extraído e convertido para texto |
| `url` | Link de cardápio/menu | Fetched, parseado e injetado |
| `qa_pairs` | Perguntas e respostas frequentes | Injetado como pares estruturados |

### Tags especiais do workspace (globais)

Algumas tags são reservadas e injetadas em **todos os nós** automaticamente:

| Tag | Conteúdo |
|---|---|
| `@workspace.profile` | Nome, endereço, horário, redes sociais |
| `@workspace.persona` | Nome do agente, tom, estilo, emojis? |
| `@workspace.rules` | Regras gerais (nunca oferecer desconto, etc.) |
| `@workspace.catalog` | Lista resumida de todos os produtos/serviços |

O usuário cria e edita essas tags no painel. Qualquer mudança reflete imediatamente em todas as conversas ativas.

---

## 5. Construção do System Prompt

Este é o prompt montado em runtime para cada chamada ao LLM. A ordem das seções importa.

```
═══════════════════════════════════════════════════
SEÇÃO 1 — IDENTIDADE (sempre presente)
═══════════════════════════════════════════════════
Você é {persona.nome}, atendente de {workspace.nome}.

Seu estilo de comunicação:
- Tom: {persona.tom}
- Uso de emoji: {persona.emoji_usage}
- Comprimento de respostas: {persona.response_length}
- Tratamento: {persona.tratamento} (você/tu/senhor)

Regras invioláveis:
{workspace.rules}

═══════════════════════════════════════════════════
SEÇÃO 2 — CONTEXTO DO CLIENTE (sempre presente)
═══════════════════════════════════════════════════
Cliente atual:
- Nome: {client.nome} {client.apelido ? "(chame de " + apelido + ")" : ""}
- Histórico resumido: {client.memory_summary}
- Última visita: {client.ultimo_agendamento.data} — {client.ultimo_agendamento.servico}
- Total de visitas: {client.total_visitas}
- Observações: {client.observacoes}

Use essas informações naturalmente na conversa quando relevar.
Nunca deixe transparecer que está lendo de um sistema.

═══════════════════════════════════════════════════
SEÇÃO 3 — CATÁLOGO GLOBAL (sempre presente)
═══════════════════════════════════════════════════
Produtos e serviços disponíveis:
{workspace.catalog_formatted}

Você conhece todos esses produtos. Pode responder perguntas sobre qualquer
um deles mesmo que não seja o foco da conversa atual.

═══════════════════════════════════════════════════
SEÇÃO 4 — CONHECIMENTO ATIVO (tags do nó atual)
═══════════════════════════════════════════════════
{knowledge_tags_content}

═══════════════════════════════════════════════════
SEÇÃO 5 — OBJETIVO ATUAL (fluxo como SOP)
═══════════════════════════════════════════════════
Fluxo ativo: {flow.nome}
Objetivo desta etapa: {node.objective}

Etapas já concluídas neste fluxo:
{session.completed_steps_summary}

Dados já coletados:
{session.collected_data}

═══════════════════════════════════════════════════
SEÇÃO 6 — INSTRUÇÕES DE COMPORTAMENTO (sempre)
═══════════════════════════════════════════════════
Diretrizes de conduta:

1. NATURALIDADE: Nunca mencione que está seguindo um fluxo, script ou sistema.
   Conduza a conversa como um atendente humano experiente faria.

2. DIGRESSÃO: Se o cliente perguntar algo fora do objetivo atual, responda
   naturalmente. Quando o desvio encerrar, retome o objetivo com suavidade.
   Jamais ignore uma pergunta legítima para "manter o foco".

3. PROATIVIDADE: Se durante a conversa você identificar uma oportunidade
   relevante para o cliente (ex: complemento de serviço, promoção aplicável,
   lembrança de procedimento anterior), aja. Não espere ser perguntado.

4. MÍDIA: Se o cliente enviou imagem, áudio ou documento, processe e responda
   o conteúdo de forma natural. Nunca diga "não consigo processar isso".

5. OBJETIVIDADE: Não faça perguntas desnecessárias. Se já tem a informação
   na memória do cliente, use — não pergunte de novo.

6. COMPLETUDE: Quando o objetivo da etapa for alcançado, avance naturalmente.
   Não fique repetindo confirmações ou pedindo validações redundantes.

═══════════════════════════════════════════════════
SEÇÃO 7 — CONVERSA ATUAL
═══════════════════════════════════════════════════
{conversation_history}

[Última mensagem do cliente]
{current_message}
```

### Controle do tamanho do contexto por nó

```typescript
interface ContextWindowConfig {
  include_client_memory: boolean      // memória persistente do cliente
  message_history_limit: number       // últimas N mensagens (default: 10)
  include_full_catalog: boolean       // catálogo completo ou apenas resumo
  knowledge_tags_limit: number        // máximo de caracteres das knowledge tags
  max_total_tokens: number            // limite total do contexto deste nó
}
```

---

## 6. Mecanismo de Digressão e Retomada

Este é o mecanismo central que torna o agente "melhor que humano".

### Estados de digressão na sessão

```typescript
type DigressionState = 
  | 'none'           // conversa seguindo o fluxo normalmente
  | 'active'         // agente está respondendo um desvio
  | 'resuming'       // agente identificou fim do desvio e vai retomar
```

### Algoritmo de detecção (executado pelo Planner)

```
Para cada mensagem do cliente:

1. Compara a mensagem com o objetivo_pendente da sessão
2. Classifica:
   - ON_TOPIC: mensagem avança o objetivo atual
   - DIGRESSION: mensagem é sobre outro assunto, mas válida
   - CHITCHAT: conversa casual (nome, clima, etc.)
   - ESCALATION: cliente quer falar com humano
   - CANCELLATION: cliente quer cancelar/encerrar

3. Se ON_TOPIC → segue o fluxo normalmente
4. Se DIGRESSION → 
   a. Salva objetivo_pendente na sessão
   b. Define digression_state = 'active'
   c. Responde a digressão com o conhecimento global
   d. Ao final da resposta, planta gancho sutil de retomada
5. Quando próxima mensagem chega e digression_state = 'active':
   a. Avalia se a digressão encerrou
   b. Se sim → define digression_state = 'resuming'
   c. Retoma objetivo_pendente naturalmente
```

### Exemplo real de sessão

```json
{
  "session_id": "sess_abc123",
  "current_node_id": "node_horario",
  "digression_state": "active",
  "objective_pending": {
    "node_id": "node_horario",
    "objective": "Confirmar horário do corte masculino",
    "collected_so_far": {
      "servico": "corte_masculino",
      "profissional": "Carlos"
    }
  },
  "digression_topic": "pergunta sobre preço do loiro"
}
```

---

## 7. Memória do Cliente

### Geração automática de memória

Ao final de cada conversa (quando um fluxo é concluído ou o cliente some por 2h+), um job assíncrono executa:

```
Claude Haiku analisa o histórico completo da conversa e gera:

{
  "apelido_preferido": "Zé",
  "preferencias": ["corte degradê", "atendimento com Carlos"],
  "ultimo_procedimento": "corte masculino degradê — 2025-04-10",
  "historico_resumido": "Cliente frequente desde jan/2025. Prefere Carlos. 
                          Faz corte mensalmente. Perguntou sobre loiro mas 
                          não quis fazer ainda. Tom casual, usa gírias.",
  "observacoes": "Sensível a preços. Responde bem a sugestões personalizadas.",
  "ultima_atualizacao": "2025-05-06T14:32:00Z"
}
```

### Como a memória é usada

- Injetada na **Seção 2** do system prompt de todo nó com `include_client_memory: true`
- O LLM usa ativamente: menciona o apelido, referencia o último procedimento, evita perguntar o que já sabe
- Atualizada incrementalmente a cada conversa (não substituída, enriquecida)

### Schema da tabela `client_memory`

```sql
CREATE TABLE client_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  workspace_id UUID REFERENCES workspaces(id),
  memory_summary TEXT,              -- resumo gerado pelo LLM
  preferred_name TEXT,              -- apelido/nome preferido
  preferences JSONB,                -- array de preferências identificadas
  last_service TEXT,                -- último serviço realizado
  observations TEXT,                -- observações do agente
  raw_insights JSONB,               -- dados estruturados adicionais
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, workspace_id)
);
```

---

## 8. Processamento de Mídia

Todo nó aceita qualquer tipo de mídia. O pré-processamento acontece antes do Planner.

### Áudio (WhatsApp voice messages)

```
Áudio recebido (formato OGG/m4a)
        ↓
OpenAI Whisper API
  model: whisper-1
  language: 'pt'
  response_format: 'text'
        ↓
Texto transcrito → entra no motor como mensagem normal
```

**Nota:** O resultado da transcrição é prefixado com `[ÁUDIO TRANSCRITO]: ` no histórico para auditoria, mas apresentado naturalmente ao LLM.

### Imagem e Documento (PDF, foto)

```
Mídia recebida
        ↓
Claude Vision (claude-sonnet-4-5)
  Prompt: "Descreva o conteúdo desta mídia de forma estruturada, 
            focando em informações relevantes para atendimento 
            em {workspace.segmento}. Inclua textos visíveis, 
            elementos principais e qualquer informação relevante."
        ↓
Descrição estruturada → entra no motor como contexto adicional
```

### Múltiplas mídias em uma mensagem

Se o cliente enviar texto + imagem na mesma mensagem, ambos são processados e concatenados antes de entrar no Planner.

---

## 9. Schema Completo do Banco (Supabase/PostgreSQL)

### Tabelas principais

```sql
-- Workspaces (cada cliente do SaaS)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  segment TEXT,                    -- 'barbearia', 'petshop', 'farmacia', etc.
  plan TEXT DEFAULT 'trial',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração do agente por workspace
CREATE TABLE workspace_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,      -- "Ju", "Edvan", "Maria"
  persona_tone TEXT NOT NULL,      -- "informal, usa emoji, chama de mano"
  persona_rules TEXT,              -- regras gerais do agente
  response_length TEXT DEFAULT 'short',  -- 'short' | 'medium' | 'long'
  emoji_usage BOOLEAN DEFAULT true,
  tratamento TEXT DEFAULT 'você',  -- 'você' | 'tu' | 'senhor/senhora'
  business_info TEXT,              -- endereço, horário, redes sociais
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Base de conhecimento
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',  -- 'text' | 'document' | 'url' | 'qa_pairs'
  is_global BOOLEAN DEFAULT false,   -- true = injetado em todos os nós
  token_estimate INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_knowledge_workspace_tag ON knowledge_base(workspace_id, tag);

-- Produtos/Serviços
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  duration_minutes INT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fluxos de conversa
CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_keywords TEXT[],         -- palavras que ativam este fluxo
  trigger_products UUID[],         -- produtos associados a este fluxo
  status TEXT DEFAULT 'draft',     -- 'draft' | 'active' | 'archived'
  is_default BOOLEAN DEFAULT false, -- fluxo de boas vindas / fallback
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nós dos fluxos
CREATE TABLE flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'step' | 'condition' | 'tool_call' | 'wait' | 'handoff'
  label TEXT,
  config JSONB NOT NULL,           -- configuração específica do tipo (ver seção 3)
  position_x FLOAT,               -- posição no canvas visual
  position_y FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arestas dos fluxos
CREATE TABLE flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  label TEXT,
  condition JSONB,                 -- { variable, operator, value }
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relação nó ↔ knowledge tags
CREATE TABLE node_knowledge_tags (
  node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  knowledge_tag TEXT NOT NULL,
  PRIMARY KEY (node_id, knowledge_tag)
);

-- Clientes finais (quem conversa com o bot)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  notes TEXT,
  crm_status TEXT DEFAULT 'new',   -- 'new' | 'active' | 'inactive' | 'vip'
  crm_tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, phone)
);

-- Memória persistente dos clientes
CREATE TABLE client_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_summary TEXT,
  preferred_name TEXT,
  preferences JSONB DEFAULT '[]',
  last_service TEXT,
  observations TEXT,
  raw_insights JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, workspace_id)
);

-- Sessões de conversa (estado em tempo real)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES flows(id),
  current_node_id UUID REFERENCES flow_nodes(id),
  channel TEXT NOT NULL,           -- 'whatsapp_ycloud' | 'whatsapp_zapi' | 'whatsapp_evolution'
  channel_session_id TEXT,         -- ID da sessão no canal externo
  status TEXT DEFAULT 'active',    -- 'active' | 'waiting' | 'handoff' | 'completed'
  digression_state TEXT DEFAULT 'none',  -- 'none' | 'active' | 'resuming'
  objective_pending JSONB,         -- objetivo pausado durante digressão
  collected_data JSONB DEFAULT '{}', -- variáveis coletadas durante o fluxo
  completed_steps TEXT[],          -- IDs dos nós já concluídos
  wait_until TIMESTAMPTZ,          -- quando o wait expira (se ativo)
  expires_at TIMESTAMPTZ,          -- expiração da sessão (inatividade)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, client_id, channel)
);
CREATE INDEX idx_sessions_active ON sessions(workspace_id, status) WHERE status = 'active';
CREATE INDEX idx_sessions_wait ON sessions(wait_until) WHERE status = 'waiting';

-- Histórico de mensagens
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  role TEXT NOT NULL,              -- 'user' | 'assistant'
  content TEXT NOT NULL,           -- conteúdo da mensagem
  media_type TEXT,                 -- 'text' | 'audio' | 'image' | 'document'
  media_url TEXT,                  -- URL da mídia original
  media_transcription TEXT,        -- transcrição/descrição da mídia
  node_id UUID,                    -- nó ativo quando a mensagem foi processada
  tokens_used INT,
  llm_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);

-- Agendamentos
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  product_id UUID REFERENCES products(id),
  professional_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  status TEXT DEFAULT 'confirmed',  -- 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes TEXT,
  session_id UUID REFERENCES sessions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de eventos para o CRM
CREATE TABLE crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  session_id UUID REFERENCES sessions(id),
  event_type TEXT NOT NULL,        -- ver seção 11
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_crm_events_unprocessed ON crm_events(workspace_id, processed) WHERE processed = false;

-- Registry de tools disponíveis
CREATE TABLE tools_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  params_schema JSONB NOT NULL,
  returns_schema JSONB NOT NULL,
  requires_confirmation BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração de canais por workspace
CREATE TABLE channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,      -- 'ycloud' | 'zapi' | 'evolution'
  credentials JSONB NOT NULL,      -- { api_key, instance_id, etc. } — CRIPTOGRAFADO
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timers de followup (processados por job assíncrono)
CREATE TABLE followup_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  target_node_id UUID REFERENCES flow_nodes(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',   -- 'pending' | 'fired' | 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_followup_pending ON followup_timers(scheduled_at) WHERE status = 'pending';
```

---

## 10. Integração de Canais

### Abstração de canal

O motor não conhece o canal. Ele trabalha com uma interface padronizada:

```typescript
interface ChannelAdapter {
  sendMessage(to: string, message: OutboundMessage): Promise<void>
  parseInbound(payload: any): InboundMessage
  downloadMedia(url: string): Promise<Buffer>
}

interface InboundMessage {
  from: string                     // número de telefone
  content: string                  // texto (já processado se mídia)
  media_type: 'text' | 'audio' | 'image' | 'document'
  media_url?: string
  timestamp: Date
  channel_message_id: string
}

interface OutboundMessage {
  text: string
  typing_simulation?: boolean      // simula "digitando..." antes de enviar
  typing_delay_ms?: number
}
```

### YCloud (API oficial WhatsApp)

```typescript
class YCloudAdapter implements ChannelAdapter {
  // POST https://api.ycloud.com/v2/whatsapp/messages
  // Webhook: POST /api/webhooks/ycloud
  // Suporta: texto, imagem, documento, áudio, template
}
```

### ZAPI / Evolution API (API não-oficial WhatsApp)

```typescript
class ZAPIAdapter implements ChannelAdapter {
  // Suporta coexistência com WhatsApp Business App
  // Webhook: POST /api/webhooks/zapi
}

class EvolutionAdapter implements ChannelAdapter {
  // Open-source, self-hosted
  // Webhook: POST /api/webhooks/evolution
}
```

### Seleção de canal por workspace

```typescript
async function getChannelAdapter(workspace_id: string): Promise<ChannelAdapter> {
  const config = await db.channel_configs.findFirst({ 
    where: { workspace_id, is_active: true } 
  })
  switch (config.channel_type) {
    case 'ycloud': return new YCloudAdapter(config.credentials)
    case 'zapi': return new ZAPIAdapter(config.credentials)
    case 'evolution': return new EvolutionAdapter(config.credentials)
  }
}
```

---

## 11. Eventos para o CRM

O motor **não move o CRM diretamente**. Ele emite eventos padronizados. O CRM escuta esses eventos e atualiza status.

### Eventos emitidos

```typescript
type CRMEventType = 
  // Conversação
  | 'conversation.started'          // nova sessão iniciada
  | 'conversation.completed'        // fluxo concluído com sucesso
  | 'conversation.abandoned'        // cliente somiu (timeout)
  | 'conversation.handoff'          // transferido para humano
  
  // Cliente
  | 'client.identified'             // nome/dados do cliente coletados
  | 'client.memory_updated'         // memória do cliente atualizada
  
  // Agendamento
  | 'appointment.created'           // agendamento criado
  | 'appointment.cancelled'         // agendamento cancelado
  | 'appointment.reminder_sent'     // lembrete enviado
  
  // Interesse
  | 'interest.product_enquiry'      // cliente perguntou sobre produto
  | 'interest.price_enquiry'        // cliente perguntou sobre preço
  | 'interest.not_ready'            // cliente interessado mas não converteu
  
  // Follow-up
  | 'followup.scheduled'            // wait node ativado
  | 'followup.fired'                // timer disparou
  | 'followup.responded'            // cliente respondeu antes do timer
```

### Payload padrão de evento

```typescript
interface CRMEvent {
  event_type: CRMEventType
  workspace_id: string
  client_id: string
  session_id: string
  timestamp: Date
  payload: {
    // dados específicos do evento
    // ex: para appointment.created:
    appointment_id?: string
    product_name?: string
    scheduled_at?: string
    professional?: string
  }
}
```

---

## 12. Jobs Assíncronos

Três jobs precisam rodar em background:

### Job 1: Processador de Followup Timers
```
Frequência: a cada 1 minuto
Ação: busca followup_timers WHERE scheduled_at <= NOW() AND status = 'pending'
      Para cada timer: retoma a sessão no target_node_id
      Atualiza status para 'fired'
```

### Job 2: Gerador de Memória de Cliente
```
Frequência: trigger por evento (conversation.completed ou inatividade de 2h)
Ação: busca histórico da conversa
      Chama Claude Haiku para gerar/atualizar client_memory
      Salva no banco
```

### Job 3: Expirador de Sessões
```
Frequência: a cada 15 minutos
Ação: busca sessions WHERE expires_at <= NOW() AND status = 'active'
      Emite evento conversation.abandoned
      Atualiza status para 'completed'
      Dispara geração de memória
```

---

## 13. API Routes (Next.js)

```
POST /api/webhooks/[channel]         Recebe mensagens dos canais
POST /api/engine/process             Processa uma mensagem (interno)
GET  /api/sessions/[id]              Estado atual de uma sessão
POST /api/flows/[id]/activate        Ativa um fluxo
POST /api/flows/[id]/deactivate      Desativa um fluxo
GET  /api/workspaces/[id]/tools      Lista tools disponíveis
POST /api/tools/[id]/execute         Executa uma tool manualmente (debug)
GET  /api/clients/[id]/memory        Memória de um cliente
POST /api/clients/[id]/memory/reset  Reseta memória de um cliente
GET  /api/crm/events                 Lista eventos CRM não processados
POST /api/crm/events/[id]/process    Marca evento como processado
```

---

## 14. Fora do Escopo deste Spec

Os seguintes itens **não** são implementados neste spec e pertencem a specs separados:

- **Flow Builder (frontend visual)** → `SPEC_FLOW_BUILDER.md`
- **Dashboard do workspace** → `SPEC_DASHBOARD.md`
- **Sistema de agendamento completo** → `SPEC_AGENDA.md`
- **CRM e pipeline de clientes** → `SPEC_CRM.md`
- **Integração de pagamento (Abacate Pay)** → `SPEC_PAGAMENTO.md`
- **Sistema de comissões** → `SPEC_COMISSAO.md`
- **Autenticação e multi-tenancy** → `SPEC_AUTH.md`
- **Geração de voz com ElevenLabs** → fase 2
- **Integração Trinks** → fase 2
- **Analytics e métricas** → fase 2

---

## 15. Dependências e Ordem de Implementação

```
1. Schema do banco (todas as tabelas acima)
2. Channel adapters (YCloud primeiro, ZAPI depois)
3. Pré-processador de mídia (Whisper + Claude Vision)
4. Sistema de knowledge base (CRUD + busca por tag)
5. Motor de sessão (criar, buscar, atualizar, expirar)
6. Construtor de system prompt (seção 5)
7. Planner (Claude Haiku) + detector de digressão
8. Executor (Claude Sonnet) + tool calling
9. Mecanismo de wait e followup timers
10. Emissor de eventos CRM
11. Jobs assíncronos (timers, memória, expiração)
12. API routes de webhook e engine
```

---

*Fim do SPEC_MOTOR_BACKEND.md*  
*Próximo: SPEC_FLOW_BUILDER.md*
