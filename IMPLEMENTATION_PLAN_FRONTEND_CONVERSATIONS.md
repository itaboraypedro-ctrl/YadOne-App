# IMPLEMENTATION_PLAN — Frontend Conversations
## Yadone · Módulo 1: Conversas

> **Referência:** SPEC_FRONTEND_CONVERSATIONS.md v1.0
> **Stack:** Next.js 16 + TypeScript + Supabase + Tailwind + shadcn/ui
> **Metodologia:** SDD — Spec-Driven Development com subagents paralelos
> **Total de tarefas:** 26
> **Atualizado:** 2026-05-07

---

## Instrução para agentes

Ao concluir sua tarefa, atualize STATUS_FRONTEND.md:
1. Marque com ✅ e data
2. Registre Iniciada em / Concluída em / Duração (formato YYYY-MM-DD HH:MM UTC-3)
3. Liste decisões técnicas relevantes
4. Confirme npx tsc --noEmit exit 0

---

## Visão geral dos blocos

```
Bloco 1 — Fundação (sequencial)
Bloco 2 — Layout + Auth (paralelo: 2 agentes)
Bloco 3 — Migrations + API Backend (paralelo: 2 agentes)
Bloco 4 — Lista de Conversas (paralelo: 3 agentes)
Bloco 5 — Área de Chat (paralelo: 3 agentes)
Bloco 6 — Controle de IA (paralelo: 2 agentes)
Bloco 7 — Input + Envio (paralelo: 3 agentes)
Bloco 8 — Painel Lateral + Realtime (paralelo: 2 agentes)
Bloco 9 — Polish + Dark Mode + Responsivo (paralelo: 2 agentes)
```

---

## BLOCO 1 — Fundação (sequencial, 1 agente)

> Pré-requisito: nenhum. Executa primeiro.

### F01 — Setup de dependências e design system
**Agente:** Claude Sonnet
**Duração estimada:** 8–12min

**O que fazer:**

1. Instalar dependências:
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install @radix-ui/react-avatar @radix-ui/react-badge @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu @radix-ui/react-scroll-area
npm install @radix-ui/react-separator @radix-ui/react-switch
npm install @radix-ui/react-tooltip @radix-ui/react-sheet
npm install next-themes
```

2. Configurar Tailwind com design system (paleta de cores, fontes, animações customizadas):
   - Editar `tailwind.config.ts` com tokens de cor do SPEC seção 8
   - Adicionar variantes dark/light via CSS variables
   - Adicionar animações: fade-in, slide-up, bounce-dots, pulse-ai

3. Criar `lib/utils.ts` com `cn()` helper (clsx + tailwind-merge)

4. Instalar e configurar shadcn/ui:
```bash
npx shadcn@latest init
npx shadcn@latest add button input textarea avatar badge tooltip
npx shadcn@latest add dropdown-menu sheet switch scroll-area separator
```

5. Criar `lib/types/frontend.ts` com tipos específicos do frontend:
   - `ConversationWithMeta` (sessão + última mensagem + cliente + contagem não lidos)
   - `MessageWithMeta` (mensagem + source + badges)
   - `AIStatus` (active | paused_global | paused_channel | paused_conversation)
   - `ChannelStatus` (canal com ai_enabled)

6. Criar `lib/supabase/client.ts` (browser, anon key) e `lib/supabase/server.ts` (server-side, service role)

7. Configurar `next-themes` em `app/layout.tsx`

**Validação:**
- `npx tsc --noEmit` exit 0
- `npm run dev` sem erros de compilação
- shadcn components importáveis

**Arquivos criados/editados:**
- tailwind.config.ts
- app/globals.css (CSS variables dark/light)
- lib/utils.ts
- lib/types/frontend.ts
- lib/supabase/client.ts
- lib/supabase/server.ts
- app/layout.tsx (next-themes provider)
- components/ui/* (shadcn)

---

## BLOCO 2 — Layout + Auth (paralelo: 2 agentes)

> Pré-requisito: F01 concluído

### F02 — Sistema de autenticação
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. Configurar Supabase Auth middleware em `middleware.ts`:
   - Protege todas as rotas `(app)/*`
   - Redireciona para `/login` se não autenticado
   - Redireciona para `/conversations` se já logado e acessar `/login`

2. Criar `app/(auth)/login/page.tsx`:
   - Form de email + senha
   - Supabase Auth signInWithPassword
   - Tratamento de erros (credenciais inválidas, email não confirmado)
   - Loading state durante login
   - Link "Esqueceu a senha?" (modal simples com campo de email)
   - Design: centralizado, card branco/dark, logo Yadone no topo

3. Criar `app/(auth)/login/actions.ts` (server actions para login/logout)

4. Criar `app/api/auth/me/route.ts`:
   - GET: retorna user + workspace_id + role
   - Usa service role para buscar workspace_users

5. Criar hook `hooks/useUser.ts`:
   - Lê sessão do Supabase client-side
   - Retorna { user, workspace_id, role, loading }

6. Criar componente `components/layout/UserMenu.tsx`:
   - Avatar + nome no rodapé da sidebar
   - Menu: Perfil (placeholder), Sair

**Validação:**
- Login funciona com credenciais do seed
- Rota protegida redireciona sem login
- Logout limpa sessão

### F03 — Layout base + Sidebar
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. Criar `app/(app)/layout.tsx`:
   - Sidebar fixa à esquerda (72px)
   - Área de conteúdo (flex, ocupa restante)
   - Auth guard: se não logado, redireciona

2. Criar `components/layout/Sidebar.tsx`:
   - Logo Yadone (SVG inline ou imagem)
   - Nav items verticais com ícones lucide-react:
     - MessageSquare (Conversas) — ativo
     - Users (Contatos) — disabled, tooltip "Em breve"
     - BarChart2 (Analytics) — disabled
     - Settings (Configurações) — disabled
   - Indicador de status da IA (bolinha colorida no ícone Conversas):
     - useAIStatus hook que lê workspace_agent_config
   - UserMenu no rodapé

3. Criar `components/layout/ThemeToggle.tsx`:
   - Toggle dark/light usando next-themes
   - Ícone Sun/Moon com transição suave
   - Posicionar no rodapé da sidebar acima do avatar

4. Criar `app/(app)/conversations/page.tsx`:
   - Layout 2 colunas: lista (360px) + área vazia com mensagem "Selecione uma conversa"
   - Estado vazio visual: ícone + texto motivacional

5. Criar `app/(app)/conversations/[id]/page.tsx`:
   - Layout 3 colunas: lista + chat + (painel lateral quando aberto)
   - Passa conversationId para ChatArea

**Validação:**
- Sidebar renderiza corretamente
- Dark/light mode funciona e persiste no reload
- Navegação entre rotas funciona

---

## BLOCO 3 — Migrations + API Backend (paralelo: 2 agentes)

> Pré-requisito: F01 concluído

### F04 — Migrations de banco
**Agente:** Claude Sonnet
**Duração estimada:** 5–8min

**O que fazer:**

Criar arquivo `supabase/migrations/028_frontend_support.sql`:

```sql
-- Controle de IA por conversa
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_paused_by UUID,
  ADD COLUMN IF NOT EXISTS ai_paused_at TIMESTAMPTZ;

-- Controle de IA por canal
ALTER TABLE channel_configs
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;

-- Rastreamento de source da mensagem
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'human')),
  ADD COLUMN IF NOT EXISTS sent_by UUID;

-- Usuários do workspace
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Seed: vincular usuário de teste ao workspace do seed
-- (executar manualmente após criar usuário no Supabase Auth dashboard)

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sessions_ai_paused ON sessions(workspace_id, ai_paused);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(workspace_id, source);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user ON workspace_users(user_id);
```

Aplicar: `npx supabase db push`

**Validação:**
- `npx supabase db push` sem erros
- Colunas existem no Supabase Studio

### F05 — API Backend (endpoints de conversas)
**Agente:** Claude Sonnet
**Duração estimada:** 15–20min

**O que fazer:**

Criar os 9 endpoints listados no SPEC seção 9. Para cada um:
- Autenticar via Supabase Auth (getUser)
- Buscar workspace_id do usuário via workspace_users
- Filtrar todos os dados por workspace_id

1. `app/api/conversations/route.ts` — GET lista conversas:
   - Join: sessions + clients + messages (última mensagem) + channel_configs
   - Ordenar por updated_at DESC
   - Paginação: cursor-based (cursor = updated_at da última)
   - Retorna ConversationWithMeta[]

2. `app/api/conversations/[id]/route.ts` — GET detalhe:
   - Sessão + cliente + canal + config de IA (ai_paused)
   - Retorna ConversationWithMeta + ai_status

3. `app/api/conversations/[id]/messages/route.ts` — GET mensagens:
   - Cursor-based pagination (cursor = created_at, direção: DESC)
   - Limit: 50 por página
   - Retorna Message[] com source e sent_by

4. `app/api/conversations/send/route.ts` — POST envio manual:
   - Valida: IA pausada nessa conversa (ai_paused = true)
   - Salva mensagem com source: 'human', sent_by: user.id
   - Chama channelClient.send (reusa o do motor)
   - Retorna mensagem criada

5. `app/api/conversations/[id]/ai/route.ts` — PATCH controle IA por conversa:
   - Body: { paused: boolean }
   - Atualiza sessions: ai_paused, ai_paused_by, ai_paused_at
   - Retorna novo status

6. `app/api/workspace/ai/route.ts` — PATCH controle IA global:
   - Body: { enabled: boolean }
   - Atualiza workspace_agent_config.ai_enabled
   - Se pausando: atualiza TODAS as sessions do workspace para ai_paused=true
   - Retorna novo status

7. `app/api/workspace/channels/[id]/ai/route.ts` — PATCH controle IA por canal:
   - Atualiza channel_configs.ai_enabled
   - Retorna novo status do canal

8. `app/api/upload/route.ts` — POST upload de arquivo:
   - Recebe multipart/form-data
   - Upload para Supabase Storage (bucket: 'attachments')
   - Retorna URL pública

9. `app/api/auth/me/route.ts` — GET dados do usuário:
   - Retorna { user, workspace_id, workspace_name, role }

**Validação:**
- `npx tsc --noEmit` exit 0
- Endpoints respondem corretamente via curl/Insomnia

---

## BLOCO 4 — Lista de Conversas (paralelo: 3 agentes)

> Pré-requisito: F02, F03, F05 concluídos

### F06 — ConversationList + ConversationCard
**Agente:** Claude Sonnet
**Duração estimada:** 15–20min

**O que fazer:**

1. `components/conversations/ConversationCard.tsx`:
   - Avatar com foto ou inicial (cor via hash do nome/número)
   - Nome + timestamp formatado (HH:MM / dia semana / DD/MM)
   - Última mensagem truncada (1 linha, com prefixo "Você:" se source=ai/human)
   - Badge 🤖 ou ⏸️ (ai_paused)
   - Ticks: ✓ ✓✓ ✓✓azul baseado em status da mensagem
   - Badge não lidos (bolinha com contagem)
   - Badge do canal (chip pequeno: YCloud, ZAPI, Evolution)
   - Borda esquerda: laranja (handoff), amarelo (ai_paused)
   - Hover: bg transition 150ms
   - Click: navega para /conversations/[id]
   - Right-click: DropdownMenu contextual

2. `components/conversations/ConversationList.tsx`:
   - Header: nome do workspace + botão busca + ícone filtro
   - Controle IA global (componente F07)
   - Filtros (componente F08)
   - ScrollArea com lista de ConversationCard
   - Estado vazio: "Nenhuma conversa encontrada"
   - Loading skeleton (3 cards placeholder)
   - Usa hook useConversations

3. `hooks/useConversations.ts`:
   - Fetcha /api/conversations na montagem
   - Cursor-based pagination (load more ao scrollar)
   - Retorna { conversations, loading, loadMore, hasMore }

**Validação:**
- Lista renderiza com dados do seed
- Scroll funciona
- Cards mostram informações corretas

### F07 — AIControlGlobal + AIControlChannel
**Agente:** Claude Sonnet
**Duração estimada:** 12–18min

**O que fazer:**

1. `components/conversations/AIControlGlobal.tsx`:
   - Card fixo no topo da lista
   - Estado: IA Ativa (verde) / Pausada (vermelho) / Parcial (amarelo)
   - Toggle global com Switch shadcn
   - Botão "Por canal ▾" que abre dropdown
   - Animação pulse ao mudar estado
   - Confirmar ação ao pausar global (modal simples: "Pausar IA para todas as conversas?")

2. `components/conversations/AIControlChannel.tsx`:
   - Dropdown com lista de canais do workspace
   - Cada canal: ícone + nome + Switch toggle + contagem de conversas ativas
   - Atualiza via PATCH /api/workspace/channels/[id]/ai

3. `hooks/useAIControl.ts`:
   - Estado: { globalStatus, channelStatuses, conversationStatus }
   - Métodos: toggleGlobal(), toggleChannel(id), toggleConversation(id)
   - Otimistic updates (atualiza UI antes da resposta da API)
   - Rollback em caso de erro

**Validação:**
- Toggle global muda estado visual imediatamente
- Dropdown de canais lista os canais corretamente
- Chamadas API funcionam

### F08 — ConversationSearch + ConversationFilters
**Agente:** Claude Haiku
**Duração estimada:** 8–12min

**O que fazer:**

1. `components/conversations/ConversationSearch.tsx`:
   - Botão lupa que expande input inline (animação 200ms)
   - Debounce 300ms no input
   - Busca por nome do cliente ou número
   - Limpa com tecla Esc ou botão ✕
   - Filtra a lista local (não chama API — performance)

2. `components/conversations/ConversationFilters.tsx`:
   - Chips horizontais com ScrollArea horizontal
   - Filtros: Todas | IA Ativa | Pausadas | Aguardando | Handoff
   - Badge com contagem em cada chip (calculada dos dados carregados)
   - Chip ativo com cor primária (#5865F2)
   - Filtra a lista local

**Validação:**
- Busca filtra corretamente
- Filtros funcionam
- Performance ok (sem chamadas extras à API)

---

## BLOCO 5 — Área de Chat (paralelo: 3 agentes)

> Pré-requisito: F05 concluído

### F09 — ChatArea + ChatHeader
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. `components/chat/ChatArea.tsx`:
   - Container principal do chat
   - Recebe conversationId como prop
   - Fetcha detalhe da conversa (/api/conversations/[id])
   - Organiza: ChatHeader + AIStatusBanner + ChatMessages + MessageInput
   - Gerencia estado de painel lateral aberto/fechado

2. `components/chat/ChatHeader.tsx`:
   - Botão voltar (mobile only, onClick: navega para /conversations)
   - Avatar + nome + número + canal
   - Status online: verde se última mensagem < 5min
   - Botões: 📞 (visual apenas), ℹ️ (toggle painel lateral), ⋮ (menu mais opções)
   - Menu mais opções: Marcar como não lido, Arquivar, Ver histórico

3. `components/chat/AIStatusBanner.tsx`:
   - Banner abaixo do header
   - IA ativa: roxo/verde, texto + botão "Pausar IA"
   - IA pausada: cinza/amarelo, texto + botão "Retomar IA"
   - Botão ✕ esconde banner visualmente (não muda estado)
   - Slide-down animation ao aparecer
   - Integra com useAIControl hook

**Validação:**
- Header mostra informações corretas
- Banner aparece/desaparece conforme estado da IA
- Toggle de IA no banner funciona

### F10 — ChatMessages + MessageBubble
**Agente:** Claude Sonnet
**Duração estimada:** 20–25min

**O que fazer:**

1. `components/chat/MessageBubble.tsx`:
   - Props: message (MessageWithMeta)
   - Variantes: user (esquerda) vs assistant (direita)
   - Tipos de conteúdo:
     * Texto: balão com quebra de linha preservada
     * Áudio: player com waveform SVG simples + duração + play/pause
     * Imagem: thumbnail (max 240px) clicável → lightbox (Dialog shadcn)
     * Arquivo: ícone por tipo + nome + tamanho + botão download
     * Sistema: texto centralizado sem balão, cor muted
   - Badges: 🤖 (source=ai), 👤 (source=human)
   - Timestamp no rodapé
   - Ticks (apenas em mensagens do lado direito):
     * ✓ grey: enviado
     * ✓✓ grey: entregue
     * ✓✓ azul: lido
   - Hover: mostrar timestamp completo em tooltip
   - Border-radius assimétrico (estilo WhatsApp)

2. `components/chat/ChatMessages.tsx`:
   - ScrollArea com lista de MessageBubble
   - Agrupamento por data com separador visual
   - Scroll automático para última mensagem ao montar
   - Scroll automático ao receber nova mensagem SE usuário está no fundo
   - Botão "↓ X novas" quando usuário scrollou para cima e chegou mensagem
   - Infinite scroll para cima (load mais mensagens antigas)
   - Loading skeleton ao carregar
   - TypingIndicator quando IA está processando

3. `components/chat/TypingIndicator.tsx`:
   - 3 pontinhos com animação bounce sequencial
   - Avatar pequeno da IA ao lado
   - Aparece quando sessão tem status processando (via realtime)

4. `hooks/useMessages.ts`:
   - Fetcha mensagens com cursor-based pagination
   - Scroll infinito para cima (histórico)
   - Retorna { messages, loading, loadOlder, hasOlder }

**Validação:**
- Mensagens de texto renderizam corretamente
- Agrupamento por data funciona
- Scroll automático funciona
- Tipos de mensagem renderizam sem quebrar layout

### F11 — MessageInput (base, sem envio de mídia)
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. `components/chat/MessageInput.tsx`:
   - Estado desabilitado quando IA ativa: placeholder + botão "Pausar IA para digitar"
   - Estado habilitado quando IA pausada: input completo
   - Textarea com auto-resize (1 linha → máx 5 linhas → scroll interno)
   - Enter envia (exceto Shift+Enter = nova linha)
   - Botão enviar: ativo apenas com texto não-vazio
   - Loading state durante envio
   - Limpa campo após envio bem-sucedido
   - Erro: toast de erro (não limpa o campo)
   - Slots para botões 📎 e 🎤 (implementados no F12)

2. Integração com POST /api/conversations/send:
   - Otimistic update: adiciona mensagem localmente antes da resposta
   - Rollback se API retornar erro

**Validação:**
- Texto pode ser enviado quando IA pausada
- Input bloqueado quando IA ativa
- Otimistic update funciona

---

## BLOCO 6 — Controle de IA no Chat (paralelo: 2 agentes)

> Pré-requisito: F05, F09 concluídos

### F12 — Controle de IA por conversa (integração completa)
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. Integrar useAIControl no ChatArea para estado por conversa
2. Implementar lógica de bloqueio do input baseado em ai_paused da sessão
3. Botão "Pausar IA" no banner: chama PATCH /api/conversations/[id]/ai
4. Botão "Retomar IA" no banner: idem com paused: false
5. Registrar quem pausou (ai_paused_by = user.id)
6. Adicionar mensagem de sistema no chat ao pausar/retomar:
   - "IA pausada por [Nome do atendente]" (mensagem sistema centralizada)
   - "IA retomada por [Nome do atendente]"

**Validação:**
- Pausar IA: input habilita, banner muda, mensagem sistema aparece
- Retomar IA: input desabilita, banner muda, mensagem sistema aparece

### F13 — Orchestrator: respeitar ai_paused por conversa
**Agente:** Claude Sonnet
**Duração estimada:** 8–12min

**O que fazer:**

Editar `lib/engine/orchestrator.ts`:

1. Após resolveOrCreateSession, verificar `session.ai_paused`
2. Se `session.ai_paused = true`:
   - Log audit `orchestrator.ai_paused_skip`
   - Retornar `{ status: 'blocked', reason: 'ai_paused_by_human' }` sem processar
3. Verificar `channel_config.ai_enabled` para o canal
4. Se `channel_config.ai_enabled = false`: mesmo comportamento
5. Verificar `workspace_agent_config.ai_enabled` para o workspace
6. Se `false`: mesmo comportamento

Esta tarefa é crítica pois garante que o motor não fala quando humano está no controle.

**Validação:**
- Enviar mensagem via webhook com ai_paused=true: motor não responde
- Verificar audit log: orchestrator.ai_paused_skip registrado

---

## BLOCO 7 — Input + Envio de Mídia (paralelo: 3 agentes)

> Pré-requisito: F11 concluído

### F14 — Envio de áudio
**Agente:** Claude Sonnet
**Duração estimada:** 15–20min

**O que fazer:**

1. `hooks/useAudioRecorder.ts`:
   - MediaRecorder API (browser nativo)
   - Estados: idle, recording, paused, stopped
   - Retorna: { isRecording, duration, audioBlob, startRecording, stopRecording, cancelRecording }
   - Formatos: audio/webm (Chrome/Firefox) ou audio/mp4 (Safari)
   - Timer de duração em segundos
   - Max: 5 minutos (auto-stop)

2. Integrar no MessageInput:
   - Botão 🎤: onMouseDown inicia, onMouseUp para
   - Durante gravação: substituir textarea por waveform animado + timer + botão cancelar
   - Waveform: SVG simples com barras aleatórias animadas (CSS animation)
   - Ao parar: preview com player simples + confirmar envio / cancelar
   - Ao confirmar: upload para /api/upload → URL → envia via /api/conversations/send

3. Upload do áudio:
   - POST /api/upload com FormData
   - Armazenar em Supabase Storage bucket 'attachments'
   - Retorna URL pública

**Validação:**
- Gravação funciona em Chrome e Safari
- Preview toca o áudio gravado
- Upload e envio funcionam

### F15 — Envio de arquivo/imagem
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. `components/chat/MediaPreview.tsx`:
   - Aparece entre o input e o textarea quando arquivo selecionado
   - Imagem: thumbnail 80px com botão ✕
   - Arquivo: ícone por tipo + nome truncado + tamanho + botão ✕
   - Múltiplos arquivos: scroll horizontal

2. Integrar no MessageInput:
   - Botão 📎: abre input[type=file] hidden
   - Tipos aceitos: image/*, application/pdf, .doc, .docx, .xls, .xlsx
   - Limite: 10MB por arquivo
   - Ao selecionar: mostrar MediaPreview
   - Ao enviar: upload → URL → envia via API

3. Lightbox para imagens no chat:
   - Dialog shadcn com imagem em tamanho maior
   - Fechar com Esc ou click fora
   - Botão de download

**Validação:**
- Seleção de arquivo mostra preview
- Upload funciona
- Lightbox abre ao clicar em imagem no chat

### F16 — Player de áudio inline
**Agente:** Claude Haiku
**Duração estimada:** 8–12min

**O que fazer:**

Criar player de áudio para mensagens de áudio recebidas (no MessageBubble):

1. `components/chat/AudioPlayer.tsx`:
   - Props: url, duration
   - Botão play/pause com ícone lucide
   - Barra de progresso clicável (seek)
   - Timer: tempo atual / duração total
   - Waveform estático decorativo (SVG com barras fixas)
   - Usa HTML5 Audio API
   - Loading state enquanto carrega

**Validação:**
- Áudio toca corretamente
- Seek funciona
- Timer atualiza em tempo real

---

## BLOCO 8 — Painel Lateral + Realtime (paralelo: 2 agentes)

> Pré-requisito: F05, F09, F12 concluídos

### F17 — Painel lateral do cliente
**Agente:** Claude Sonnet
**Duração estimada:** 12–18min

**O que fazer:**

1. `components/client-panel/ClientPanel.tsx`:
   - Sheet shadcn (desliza da direita, 300px)
   - Abre/fecha via botão ℹ️ no ChatHeader
   - Seções (com Separator entre elas):
     * Info do contato: avatar grande, nome, telefone, canal, "desde" (data primeira mensagem)
     * Memória da IA: preferred_name, preferences, last_service, observations
     * Controle de IA: Switch toggle (pausa/ativa IA para essa conversa)
     * Histórico: contagem de sessões + botão "Ver histórico" (placeholder)
     * Agendamentos: próximo agendamento (se existir)

2. `components/client-panel/ClientMemory.tsx`:
   - Lista estruturada de memória semântica
   - Busca em client_memory via API /api/admin/clients
   - Loading skeleton
   - Estado vazio: "Sem memória registrada ainda"

3. `components/client-panel/ClientHistory.tsx`:
   - Lista de sessões anteriores com data e status
   - Click em sessão: abre /conversations/[session_id] (placeholder por ora)

**Validação:**
- Painel abre e fecha suavemente
- Memória da IA carrega e exibe corretamente
- Toggle de IA no painel funciona

### F18 — Supabase Realtime
**Agente:** Claude Sonnet
**Duração estimada:** 15–20min

**O que fazer:**

1. `hooks/useRealtimeSubscription.ts`:
   - Abstração genérica sobre Supabase Realtime
   - Gerencia subscribe/unsubscribe no mount/unmount
   - Retorna { data, status }

2. Integrar realtime na lista de conversas:
   - Subscrever messages:workspace_id=eq.{id} (INSERT)
   - Ao receber: atualizar last_message do card + reordenar lista + incrementar badge não lidos
   - Subscrever sessions:workspace_id=eq.{id} (UPDATE)
   - Ao receber: atualizar badges de status (handoff, ai_paused)

3. Integrar realtime no chat:
   - Subscrever messages:session_id=eq.{id} (INSERT)
   - Ao receber: adicionar mensagem ao final + scroll automático (se no fundo)
   - Subscrever sessions:id=eq.{id} (UPDATE)
   - Ao receber: atualizar estado de IA + banner

4. Integrar realtime no controle de IA global:
   - Subscrever workspace_agent_config:workspace_id=eq.{id} (UPDATE)
   - Ao receber: atualizar indicador na sidebar + cards na lista

5. Indicador "IA processando...":
   - Subscrever crm_events:workspace_id=eq.{id} (INSERT onde event_type = 'planner.decision')
   - Ao receber: mostrar TypingIndicator na conversa afetada
   - Remove automaticamente após 30s ou ao receber message.sent

**Validação:**
- Nova mensagem aparece em tempo real no chat
- Lista de conversas reordena ao receber mensagem
- Badge de não lidos incrementa
- Toggle de IA no painel atualiza lista

---

## BLOCO 9 — Polish + Dark Mode + Responsivo (paralelo: 2 agentes)

> Pré-requisito: todos os blocos anteriores concluídos

### F19 — Dark Mode + Animações
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. Revisar todos os componentes para garantir compatibilidade dark/light:
   - Usar CSS variables em vez de cores hardcoded
   - Testar cada componente em ambos os modos

2. Implementar animações pendentes:
   - Mensagem nova: fade-in + slide-up (Tailwind: animate-in fade-in slide-in-from-bottom-2)
   - Toggle IA: pulse animation (Tailwind: animate-pulse)
   - IA processando: bounce dots (CSS keyframes)
   - Painel lateral: sheet animation já do shadcn (verificar smoothness)

3. Persistir preferência de tema:
   - next-themes persiste automaticamente via localStorage
   - Verificar que não há flash de tema errado no carregamento (SSR)

4. Polir detalhes visuais:
   - Scrollbars customizadas (thin, com cor do theme)
   - Focus rings com cor primária
   - Seleção de texto com cor primária

**Validação:**
- Dark mode sem elementos com cor errada
- Animações suaves (sem jank)
- Sem flash de tema no carregamento

### F20 — Responsividade mobile
**Agente:** Claude Sonnet
**Duração estimada:** 10–15min

**O que fazer:**

1. Mobile (< 768px):
   - Sidebar: hidden (nav mobile no futuro — módulo seguinte)
   - Lista: ocupa 100% da largura
   - Chat: ocupa 100% ao navegar para /conversations/[id]
   - Botão voltar no ChatHeader: navega para /conversations
   - Sheet do painel lateral: ocupa 85% da largura

2. Tablet (768–1279px):
   - Sidebar: icon-only (já é 72px, ok)
   - Lista: 320px
   - Chat: ocupa restante

3. Touch:
   - Long press em card de conversa: abre menu contextual (mesmo que right-click)
   - Swipe para voltar (mobile Safari: funciona nativamente)

4. Keyboard:
   - Tab navigation funciona corretamente
   - Esc fecha painel lateral e lightbox

**Validação:**
- Layout correto em iPhone 14 (390px)
- Layout correto em iPad (768px)
- Layout correto em 1280px+
- Long press funciona em touch

---

## Tabela de dependências entre tarefas

| Tarefa | Depende de | Pode rodar em paralelo com |
|---|---|---|
| F01 | — | — |
| F02 | F01 | F03, F04, F05 |
| F03 | F01 | F02, F04, F05 |
| F04 | F01 | F02, F03, F05 |
| F05 | F01 | F02, F03, F04 |
| F06 | F02, F03, F05 | F07, F08 |
| F07 | F02, F03, F05 | F06, F08 |
| F08 | F02, F03, F05 | F06, F07 |
| F09 | F05 | F10, F11 |
| F10 | F05 | F09, F11 |
| F11 | F09 | F10 |
| F12 | F05, F09 | F13 |
| F13 | F05 | F12 |
| F14 | F11 | F15, F16 |
| F15 | F11 | F14, F16 |
| F16 | F10 | F14, F15 |
| F17 | F05, F09, F12 | F18 |
| F18 | F05, F09, F12 | F17 |
| F19 | todos anteriores | F20 |
| F20 | todos anteriores | F19 |

---

## Sequência de execução recomendada

```
Dia 1:
  [F01] Setup fundação (sequencial)
  [F02 ‖ F03 ‖ F04 ‖ F05] Layout + Auth + Migrations + API (paralelo)

Dia 2:
  [F06 ‖ F07 ‖ F08] Lista de conversas (paralelo)
  [F09 ‖ F10 ‖ F11] Chat base (paralelo)

Dia 3:
  [F12 ‖ F13] Controle de IA no chat (paralelo)
  [F14 ‖ F15 ‖ F16] Envio de mídia (paralelo)

Dia 4:
  [F17 ‖ F18] Painel lateral + Realtime (paralelo)
  [F19 ‖ F20] Polish + Dark mode + Responsivo (paralelo)
```

---

## Métricas de progresso

| Bloco | Tarefas | Concluídas | % |
|---|---|---|---|
| 1 — Fundação | 1 | 0 | 0% |
| 2 — Layout + Auth | 2 | 0 | 0% |
| 3 — Migrations + API | 2 | 0 | 0% |
| 4 — Lista Conversas | 3 | 0 | 0% |
| 5 — Área de Chat | 3 | 0 | 0% |
| 6 — Controle de IA | 2 | 0 | 0% |
| 7 — Input + Mídia | 3 | 0 | 0% |
| 8 — Painel + Realtime | 2 | 0 | 0% |
| 9 — Polish | 2 | 0 | 0% |
| **TOTAL** | **20** | **0** | **0%** |

---

*Próximo módulo após entrega deste: IMPLEMENTATION_PLAN_FRONTEND_CONTACTS.md*
