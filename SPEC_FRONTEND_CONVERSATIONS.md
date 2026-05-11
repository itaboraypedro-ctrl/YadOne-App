# SPEC_FRONTEND_CONVERSATIONS — Módulo de Conversas
## Yadone · WhatsApp Web Interno

> **Versão:** 1.0
> **Módulo:** Conversations (Módulo 1 de N)
> **Stack:** Next.js 16 (App Router) + TypeScript + Supabase Realtime + Tailwind CSS + shadcn/ui
> **Tema:** Dark/Light toggle · Estilo moderno e colorido (referência: Slack, Discord)
> **Atualizado:** 2026-05-07

---

## 1. Visão geral

Interface web para donos de negócio e suas equipes visualizarem e gerenciarem conversas atendidas pela IA Yadone. O produto é multi-tenant SaaS — cada cliente vê apenas o seu workspace.

Este documento especifica o Módulo 1: Conversas. Módulos futuros (Contatos, Analytics, Configurações, Flow Builder) serão especificados separadamente.

---

## 2. Arquitetura de telas

### Layout geral (3 colunas)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (72px)  │  LISTA (360px)          │  CHAT AREA (flex)       │
│                  │                         │                         │
│  Logo            │  Search + Filtros        │  Header do chat         │
│  Nav icons       │  Controle de IA global   │  Mensagens              │
│  Avatar user     │  Lista de conversas      │  Input de envio         │
│                  │                         │  Painel lateral         │
└──────────────────────────────────────────────────────────────────────┘
```

### Responsividade
- Desktop 1280px+: 3 colunas visíveis simultaneamente
- Tablet 768–1279px: sidebar colapsada + lista + chat
- Mobile menor que 768px: uma coluna por vez (lista → chat ao clicar)

---

## 3. Componentes detalhados

### 3.1 Sidebar (72px)

Elementos:
- Logo Yadone (topo)
- Ícones de navegação vertical: Conversas (ativo), Contatos, Analytics, Configurações (desabilitados — módulos futuros)
- Indicador de status da IA global no ícone de conversas: verde (ativa), vermelho (pausada), amarelo (parcial)
- Avatar do usuário logado no rodapé com menu (perfil, logout)

Comportamento:
- Tooltip com nome ao hover
- Ícones desabilitados mostram tooltip "Em breve"

---

### 3.2 Lista de Conversas (360px)

#### Header da lista
- Nome do workspace
- Botão de busca (expande input inline)
- Ícone de filtro com dropdown

#### Controle de IA Global
Card fixo no topo da lista:

```
┌──────────────────────────────────────────┐
│  🤖 IA Yadone                  [● ATIVA] │
│  Respondendo automaticamente             │
│  [Pausar tudo]  [Por canal ▾]            │
└──────────────────────────────────────────┘
```

- Toggle global: pausa/ativa IA para todas as conversas
- Por canal: dropdown com toggle por canal (YCloud, ZAPI, Evolution)
- Visual: verde (ativa) / vermelho (pausada) / amarelo (parcial)
- Animação suave na transição de estado

#### Filtros
Chips horizontais: Todas | IA Ativa | Pausadas | Aguardando | Handoff
Badge com contagem em cada chip

#### Cards de conversa

```
┌──────────────────────────────────────────────────────┐
│  [Avatar]  Nome do cliente          08:32  [🤖 ou ⏸]│
│            Última mensagem truncada...       ✓✓      │
│            [canal]  [tag opcional]                   │
└──────────────────────────────────────────────────────┘
```

Elementos:
- Avatar com foto ou inicial com cor gerada por hash
- Nome do cliente (ou número se não cadastrado)
- Timestamp: HH:MM (hoje), dia da semana (essa semana), DD/MM (mais antigo)
- Última mensagem truncada em 1 linha, com prefixo "Você:" se foi do atendente/IA
- Badge de IA: 🤖 (ativa) ou ⏸️ (pausada)
- Ticks: ✓ enviado, ✓✓ entregue, ✓✓ azul lido
- Badge de não lidos com contagem
- Badge de canal (chip pequeno)
- Borda esquerda colorida: laranja (handoff), amarelo (aguardando humano)

Interações:
- Hover: background levemente destacado (150ms)
- Click: abre chat, marca como lido
- Right click: menu contextual (pausar IA, arquivar, marcar não lido)

Ordenação: mais recente primeiro, atualizado em realtime

---

### 3.3 Área de Chat

#### Header do chat

```
┌───────────────────────────────────────────────────────────────────┐
│ [← Voltar]  [Avatar]  Nome  🟢 Online  │ [📞] [ℹ️] [⋮]           │
│             +55 11 99999-9999 · YCloud  │                         │
└───────────────────────────────────────────────────────────────────┘
```

#### Banner de controle de IA (fixo abaixo do header)

IA ativa:
```
┌───────────────────────────────────────────────────────────────────┐
│  🤖 IA respondendo automaticamente          [Pausar IA]   [✕]    │
└───────────────────────────────────────────────────────────────────┘
```

IA pausada:
```
┌───────────────────────────────────────────────────────────────────┐
│  ⏸️ IA pausada — você está no controle      [Retomar IA]  [✕]    │
└───────────────────────────────────────────────────────────────────┘
```

Animação slide-down ao aparecer.

#### Área de mensagens (scroll)

Agrupamento por data: "Hoje", "Ontem", "Segunda-feira", "12 de maio"

Balão do cliente (esquerda):
```
[Avatar]  ┌──────────────────────────┐
          │ Texto da mensagem        │
          └──────────────────────────┘
           14:32
```

Balão da IA/atendente (direita):
```
          ┌──────────────────────────┐  [Avatar IA]
          │ Texto da mensagem        │
          └──────────────────────────┘
           14:33  ✓✓  🤖
```

Tipos de mensagem suportados:
- Texto: balão simples com quebra de linha
- Áudio: player inline com waveform, duração, botão play/pause
- Imagem: thumbnail clicável que abre lightbox
- Arquivo: ícone + nome + tamanho + botão download
- Sistema: texto centralizado sem balão (ex: "IA pausada por Pedro")

Indicadores:
- 🤖 em mensagens da IA
- 👤 em mensagens manuais do atendente
- Pontinhos animados "IA processando..." quando motor está ativo

Scroll:
- Automático para última mensagem ao abrir
- Automático ao receber nova mensagem (se usuário está no fundo)
- Botão "↓ X novas mensagens" se usuário scrollou e chegou mensagem nova

#### Input de envio

IA ativa (input desabilitado):
```
┌──────────────────────────────────────────────────────────────────┐
│  🤖 IA está respondendo — [Pausar IA para digitar]               │
└──────────────────────────────────────────────────────────────────┘
```

IA pausada (input habilitado):
```
┌──────────────────────────────────────────────────────────────────┐
│  [📎] [🎤]  Digite uma mensagem...                   [Enviar →]  │
└──────────────────────────────────────────────────────────────────┘
```

Funcionalidades:
- Auto-resize até 5 linhas, depois scroll interno
- Enter envia, Shift+Enter nova linha
- 📎: seletor de arquivo (imagens, PDFs, docs)
- 🎤: hold para gravar áudio, soltar para enviar (waveform animado + timer)
- Preview de arquivo/imagem antes de enviar com botão de cancelar

---

### 3.4 Painel Lateral do Cliente (abre ao clicar em ℹ️)

Painel deslizante da direita (300px):

```
┌────────────────────────────────────┐
│  [✕]  Info do contato              │
│                                    │
│  [Avatar grande]                   │
│  Nome do cliente                   │
│  +55 11 99999-9999                 │
│  Canal: YCloud                     │
│  Desde: 12 mai 2026                │
│                                    │
│  ─── Memória da IA ────────────    │
│  Apelido: João                     │
│  Preferências: degradê c/ Carlos   │
│  Último serviço: Corte + barba     │
│  Observações: prefere manhã        │
│                                    │
│  ─── Controle de IA ──────────     │
│  [🤖 IA Ativa]  [Pausar]           │
│                                    │
│  ─── Histórico ───────────────     │
│  3 sessões anteriores              │
│  [Ver histórico completo]          │
│                                    │
│  ─── Agendamentos ────────────     │
│  Próximo: 15 mai 09:00 - Corte     │
└────────────────────────────────────┘
```

---

## 4. Autenticação

### Fluxo de login
1. Tela de login com email + senha
2. Supabase Auth gerencia sessão
3. Após login: redireciona para /conversations
4. Sessão persistente via cookie (Supabase padrão)

### Multi-tenant
- Cada usuário pertence a um workspace_id
- Todas as queries filtram por workspace_id do usuário logado
- RLS habilitado no Supabase para isolamento garantido no banco
- Middleware Next.js protege todas as rotas (auth)/app/

### Tela de login

```
┌──────────────────────────────────┐
│         Logo Yadone              │
│                                  │
│  Bem-vindo de volta              │
│                                  │
│  [Email________________]         │
│  [Senha________________]         │
│                                  │
│  [Entrar →]                      │
│                                  │
│  Esqueceu a senha?               │
└──────────────────────────────────┘
```

---

## 5. Realtime (Supabase)

Canais subscritos por sessão:
- messages:workspace_id=eq.{id} → novas mensagens em qualquer conversa
- sessions:workspace_id=eq.{id} → mudança de status de sessão
- workspace_agent_config:workspace_id=eq.{id} → mudança de config global de IA

Comportamento:
- Mensagem nova: atualiza lista (reordena) + atualiza chat se conversa aberta
- Sessão muda para handoff: badge laranja aparece no card
- IA pausada globalmente: todos os badges atualizam, banner no chat muda

---

## 6. Controle de IA — regras de negócio

### Estados

| Estado | Descrição | Visual |
|---|---|---|
| active | IA responde automaticamente | 🟢 Verde |
| paused_global | IA pausada para todo o workspace | 🔴 Vermelho |
| paused_channel | IA pausada para canal específico | 🔴 Vermelho no canal |
| paused_conversation | IA pausada nessa conversa | ⏸️ no card e no chat |

### Regras
1. Para responder manualmente: obrigatório pausar IA da conversa primeiro
2. Pausar global pausa todas as conversas
3. Retomar global NÃO retoma conversas pausadas individualmente (preserva estado local)
4. Pausar por canal pausa todas as conversas daquele canal
5. Mensagem humana salva com source: 'human'
6. Mensagem humana é enviada via channelClient (mesmo canal da conversa)

### Onde é armazenado
- Global: workspace_agent_config.ai_enabled (boolean)
- Por canal: channel_configs.ai_enabled (boolean — adicionar campo em migration)
- Por conversa: sessions.ai_paused (boolean) + sessions.ai_paused_by (user_id) — adicionar em migration

---

## 7. Envio de mensagem manual

### Texto
1. Atendente pausa IA
2. Input habilitado
3. Envia via POST /api/conversations/send
4. Salvo com role: 'assistant', source: 'human', sent_by: user_id
5. Enviado via channelClient.send
6. Aparece no chat com badge 👤

### Áudio
1. Pressiona e segura 🎤
2. Gravação via MediaRecorder API
3. Waveform animado + timer
4. Ao soltar: preview com player + cancelar
5. Ao confirmar: upload Supabase Storage → URL → envia

### Arquivo
1. Clica 📎
2. Seletor de arquivo (imagem, PDF, doc, xls)
3. Preview antes de enviar
4. Upload Supabase Storage → URL → envia com tipo correto

---

## 8. Design system

### Paleta de cores

```
Primária:     #5865F2  (roxo Discord-like)
Secundária:   #57F287  (verde)
Perigo:       #ED4245  (vermelho)
Aviso:        #FEE75C  (amarelo)

Dark mode:
  Background:   #0F0F13
  Surface:      #1E1F26
  Border:       #2E2F3B
  Text:         #E3E5E8
  Muted:        #96989D

Light mode:
  Background:   #F8F9FA
  Surface:      #FFFFFF
  Border:       #E3E5E8
  Text:         #1A1A2E
  Muted:        #6B7280
```

### Tipografia
- Fonte: Inter (Google Fonts)
- 12px (captions), 14px (body), 16px (títulos), 20px (heading)

### Animações
- Transições: 150ms ease-out (hover, focus)
- Slide-in painel lateral: 200ms ease-out
- Mensagem nova: fade-in + slide-up 200ms
- Toggle IA: pulse 300ms
- IA processando: bounce 600ms loop

### Componentes shadcn/ui
Button, Input, Textarea, Avatar, Badge, Tooltip, DropdownMenu, Sheet, Switch, ScrollArea, Separator

---

## 9. Endpoints novos necessários

| Endpoint | Método | Descrição |
|---|---|---|
| /api/conversations | GET | Lista conversas do workspace |
| /api/conversations/[id] | GET | Detalhe + mensagens |
| /api/conversations/[id]/messages | GET | Mensagens paginadas (cursor) |
| /api/conversations/send | POST | Envia mensagem manual |
| /api/conversations/[id]/ai | PATCH | Pausa/ativa IA de uma conversa |
| /api/workspace/ai | PATCH | Pausa/ativa IA global |
| /api/workspace/channels/[id]/ai | PATCH | Pausa/ativa IA de um canal |
| /api/upload | POST | Upload para Supabase Storage |
| /api/auth/me | GET | Usuário logado + workspace |

---

## 10. Estrutura de arquivos

```
app/
├── (auth)/
│   └── login/page.tsx
├── (app)/
│   ├── layout.tsx                  ← sidebar + auth guard
│   └── conversations/
│       ├── page.tsx
│       └── [id]/page.tsx
└── api/
    ├── conversations/
    │   ├── route.ts
    │   ├── send/route.ts
    │   └── [id]/
    │       ├── route.ts
    │       ├── messages/route.ts
    │       └── ai/route.ts
    ├── workspace/
    │   ├── ai/route.ts
    │   └── channels/[id]/ai/route.ts
    ├── upload/route.ts
    └── auth/me/route.ts

components/
├── conversations/
│   ├── ConversationList.tsx
│   ├── ConversationCard.tsx
│   ├── ConversationSearch.tsx
│   ├── AIControlGlobal.tsx
│   ├── AIControlChannel.tsx
│   └── ConversationFilters.tsx
├── chat/
│   ├── ChatArea.tsx
│   ├── ChatHeader.tsx
│   ├── ChatMessages.tsx
│   ├── MessageBubble.tsx
│   ├── MessageInput.tsx
│   ├── AIStatusBanner.tsx
│   ├── TypingIndicator.tsx
│   └── MediaPreview.tsx
├── client-panel/
│   ├── ClientPanel.tsx
│   ├── ClientMemory.tsx
│   └── ClientHistory.tsx
├── layout/
│   ├── Sidebar.tsx
│   └── ThemeToggle.tsx
└── ui/                             ← shadcn/ui

hooks/
├── useConversations.ts
├── useMessages.ts
├── useAIControl.ts
├── useAudioRecorder.ts
└── useRealtimeSubscription.ts

lib/
├── supabase/
│   ├── client.ts                   ← browser (anon key)
│   └── server.ts                   ← servidor (service role)
└── types/frontend.ts
```

---

## 11. Migrations necessárias

Campos novos no banco para suportar o frontend:

```sql
-- Controle de IA por conversa
ALTER TABLE sessions
  ADD COLUMN ai_paused BOOLEAN DEFAULT false,
  ADD COLUMN ai_paused_by UUID REFERENCES auth.users(id),
  ADD COLUMN ai_paused_at TIMESTAMPTZ;

-- Controle de IA por canal
ALTER TABLE channel_configs
  ADD COLUMN ai_enabled BOOLEAN DEFAULT true;

-- Rastreamento de source da mensagem
ALTER TABLE messages
  ADD COLUMN source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'human')),
  ADD COLUMN sent_by UUID REFERENCES auth.users(id);

-- Usuários do workspace (auth multi-tenant)
CREATE TABLE workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

---

## 12. Critérios de conclusão do módulo

- [ ] Login funcional com Supabase Auth
- [ ] Lista de conversas carrega e atualiza em realtime
- [ ] Chat abre ao clicar em conversa
- [ ] Mensagens carregam com scroll infinito (cursor-based pagination)
- [ ] Novas mensagens aparecem em realtime sem refresh
- [ ] Envio de texto manual funciona
- [ ] Envio de áudio funciona (gravação + waveform + envio)
- [ ] Envio de arquivo funciona (imagem + PDF)
- [ ] Controle de IA global funciona (pausa/ativa tudo)
- [ ] Controle de IA por canal funciona
- [ ] Controle de IA por conversa funciona
- [ ] Painel lateral do cliente abre com memória da IA
- [ ] Dark/Light mode toggle funciona e persiste
- [ ] Responsivo em mobile
- [ ] Ticks de mensagem (enviado/entregue/lido)
- [ ] Badge 🤖 e 👤 distinguindo IA de humano
- [ ] Indicador "IA processando..." em tempo real
- [ ] Migrations aplicadas e banco atualizado

---

*Próximo módulo após entrega deste: SPEC_FRONTEND_CONTACTS.md*
