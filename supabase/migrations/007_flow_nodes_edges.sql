-- Migration 007: Nós e arestas dos fluxos
-- ROLLBACK:
--   DROP TABLE IF EXISTS flow_edges CASCADE;
--   DROP TABLE IF EXISTS flow_nodes CASCADE;

CREATE TABLE flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  position_x FLOAT,
  position_y FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  label TEXT,
  condition JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
