-- Migration 028: Suporte de schema para Frontend de Conversas (Módulo 1).
-- SPEC_FRONTEND_CONVERSATIONS.md §11.
-- Adiciona controle de IA por conversa/canal, source da mensagem (ai vs humano)
-- e tabela de vínculo workspace_users (auth multi-tenant).
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_workspace_users_workspace;
--   DROP INDEX IF EXISTS idx_workspace_users_user;
--   DROP INDEX IF EXISTS idx_messages_source;
--   DROP INDEX IF EXISTS idx_sessions_ai_paused;
--   DROP TABLE IF EXISTS workspace_users;
--   ALTER TABLE messages DROP COLUMN IF EXISTS sent_by, DROP COLUMN IF EXISTS source;
--   ALTER TABLE channel_configs DROP COLUMN IF EXISTS ai_enabled;
--   ALTER TABLE sessions DROP COLUMN IF EXISTS ai_paused_at, DROP COLUMN IF EXISTS ai_paused_by, DROP COLUMN IF EXISTS ai_paused;

-- ============================================================
-- 1. Controle de IA por conversa
-- ============================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_paused_by UUID,
  ADD COLUMN IF NOT EXISTS ai_paused_at TIMESTAMPTZ;

COMMENT ON COLUMN sessions.ai_paused IS 'Quando true, o motor não responde nessa conversa (humano no controle).';
COMMENT ON COLUMN sessions.ai_paused_by IS 'auth.users.id do atendente que pausou — referência fraca (sem FK p/ permitir limpeza de auth).';
COMMENT ON COLUMN sessions.ai_paused_at IS 'Timestamp do pause (auditoria).';

-- ============================================================
-- 2. Controle de IA por canal
-- ============================================================
ALTER TABLE channel_configs
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN channel_configs.ai_enabled IS 'Quando false, motor não responde mensagens vindas deste canal.';

-- ============================================================
-- 3. Source da mensagem (rastreio AI vs humano)
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'human')),
  ADD COLUMN IF NOT EXISTS sent_by UUID;

COMMENT ON COLUMN messages.source IS 'Origem da mensagem outbound: ai (motor) ou human (atendente).';
COMMENT ON COLUMN messages.sent_by IS 'auth.users.id do atendente quando source=human.';

-- ============================================================
-- 4. Usuários do workspace (auth multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

COMMENT ON TABLE workspace_users IS 'Vincula usuários do Supabase Auth a workspaces. role=owner pode pausar IA global.';

-- ============================================================
-- 5. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_ai_paused
  ON sessions(workspace_id, ai_paused) WHERE ai_paused = true;
CREATE INDEX IF NOT EXISTS idx_messages_source
  ON messages(workspace_id, source);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user
  ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace
  ON workspace_users(workspace_id);
