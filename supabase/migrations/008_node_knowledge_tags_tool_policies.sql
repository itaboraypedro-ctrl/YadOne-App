-- Migration 008: Relações nó↔knowledge tags e allowlist de tools por fluxo
-- ROLLBACK:
--   DROP TABLE IF EXISTS flow_tool_policies CASCADE;
--   DROP TABLE IF EXISTS node_knowledge_tags CASCADE;

CREATE TABLE node_knowledge_tags (
  node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  knowledge_tag TEXT NOT NULL,
  PRIMARY KEY (node_id, knowledge_tag)
);

CREATE TABLE flow_tool_policies (
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (flow_id, tool_id)
);
