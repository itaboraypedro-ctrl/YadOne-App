-- Migration 025: Índices (incluindo HNSW para colunas vector)
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_sessions_active;
--   DROP INDEX IF EXISTS idx_sessions_wait;
--   DROP INDEX IF EXISTS idx_sessions_workspace_client;
--   DROP INDEX IF EXISTS idx_messages_session;
--   DROP INDEX IF EXISTS idx_messages_trace;
--   DROP INDEX IF EXISTS idx_crm_events_unprocessed;
--   DROP INDEX IF EXISTS idx_crm_events_trace;
--   DROP INDEX IF EXISTS idx_followup_pending;
--   DROP INDEX IF EXISTS idx_knowledge_workspace_tag;
--   DROP INDEX IF EXISTS idx_knowledge_chunks_kb;
--   DROP INDEX IF EXISTS idx_idempotency_expires;
--   DROP INDEX IF EXISTS idx_audit_workspace_event;
--   DROP INDEX IF EXISTS idx_audit_trace;
--   DROP INDEX IF EXISTS idx_clients_unified;
--   DROP INDEX IF EXISTS idx_episodic_client;
--   DROP INDEX IF EXISTS idx_rate_limit_window;
--   DROP INDEX IF EXISTS idx_usage_metrics_workspace;
--   DROP INDEX IF EXISTS idx_appointments_scheduled;
--   DROP INDEX IF EXISTS idx_monitor_decisions_session;
--   DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;
--   DROP INDEX IF EXISTS idx_episodic_embedding;

-- Sessões
CREATE INDEX idx_sessions_active
  ON sessions (workspace_id, status)
  WHERE status = 'active';

CREATE INDEX idx_sessions_wait
  ON sessions (wait_until)
  WHERE status = 'waiting';

CREATE INDEX idx_sessions_workspace_client
  ON sessions (workspace_id, client_id);

-- Mensagens
CREATE INDEX idx_messages_session
  ON messages (session_id, created_at);

CREATE INDEX idx_messages_trace
  ON messages (trace_id)
  WHERE trace_id IS NOT NULL;

-- CRM events
CREATE INDEX idx_crm_events_unprocessed
  ON crm_events (workspace_id, processed)
  WHERE processed = false;

CREATE INDEX idx_crm_events_trace
  ON crm_events (trace_id)
  WHERE trace_id IS NOT NULL;

-- Followup timers
CREATE INDEX idx_followup_pending
  ON followup_timers (scheduled_at)
  WHERE status = 'pending';

-- Knowledge
CREATE INDEX idx_knowledge_workspace_tag
  ON knowledge_base (workspace_id, tag);

CREATE INDEX idx_knowledge_chunks_kb
  ON knowledge_chunks (kb_id, chunk_index);

-- Idempotency
CREATE INDEX idx_idempotency_expires
  ON idempotency_keys (expires_at);

-- Audit
CREATE INDEX idx_audit_workspace_event
  ON audit_logs (workspace_id, event_type, created_at);

CREATE INDEX idx_audit_trace
  ON audit_logs (trace_id)
  WHERE trace_id IS NOT NULL;

-- Clients
CREATE INDEX idx_clients_unified
  ON clients (unified_id)
  WHERE unified_id IS NOT NULL;

-- Episódica
CREATE INDEX idx_episodic_client
  ON client_episodic_memory (client_id, occurred_at DESC);

-- Rate limit
CREATE INDEX idx_rate_limit_window
  ON rate_limit_buckets (window_end);

-- Usage metrics
CREATE INDEX idx_usage_metrics_workspace
  ON usage_metrics (workspace_id, recorded_at DESC);

-- Appointments
CREATE INDEX idx_appointments_scheduled
  ON appointments (workspace_id, scheduled_at);

-- Monitor decisions
CREATE INDEX idx_monitor_decisions_session
  ON monitor_decisions (session_id, created_at DESC);

-- HNSW para busca por similaridade vetorial (cosine distance)
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_episodic_embedding
  ON client_episodic_memory
  USING hnsw (embedding vector_cosine_ops);
