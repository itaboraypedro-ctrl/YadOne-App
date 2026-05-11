-- Migration 026: RPC functions para vector search (pgvector via supabase-js .rpc())
-- supabase-js não expõe o operador <=> diretamente; encapsulamos as queries em PG functions.
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS vector_search_episodes(uuid, vector, int);
--   DROP FUNCTION IF EXISTS vector_search_chunks(uuid, vector, int, uuid[]);

CREATE OR REPLACE FUNCTION vector_search_episodes(
  p_client_id uuid,
  p_query vector(1536),
  p_top_k int
)
RETURNS SETOF client_episodic_memory
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM client_episodic_memory
  WHERE client_id = p_client_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> p_query
  LIMIT p_top_k;
$$;

CREATE OR REPLACE FUNCTION vector_search_chunks(
  p_workspace_id uuid,
  p_query vector(1536),
  p_top_k int,
  p_kb_ids uuid[] DEFAULT NULL
)
RETURNS SETOF knowledge_chunks
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM knowledge_chunks
  WHERE workspace_id = p_workspace_id
    AND embedding IS NOT NULL
    AND (p_kb_ids IS NULL OR kb_id = ANY(p_kb_ids))
  ORDER BY embedding <=> p_query
  LIMIT p_top_k;
$$;
