-- Migration 029: workspace_agent_config.ai_enabled (controle de IA global por workspace).
-- Gap detectado em F05 (frontend): SPEC_FRONTEND_CONVERSATIONS.md §6 referencia este campo
-- para o motor consultar em runtime (F13).
--
-- ROLLBACK:
--   ALTER TABLE workspace_agent_config DROP COLUMN IF EXISTS ai_enabled;

ALTER TABLE workspace_agent_config
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN workspace_agent_config.ai_enabled IS
  'Quando false, motor não responde nenhuma mensagem do workspace. Override por canal e por conversa: SPEC §6.';
