-- supabase/seed.sql
-- Dataset de desenvolvimento: barbearia "Edvan"
-- Idempotente: ON CONFLICT DO NOTHING em todos os inserts.
-- IDs fixos para permitir referência entre tabelas e re-execução segura.

-- ============================================================
-- 1. Workspace
-- ============================================================
INSERT INTO workspaces (id, name, slug, segment, plan, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Barbearia Edvan',
  'edvan',
  'barbearia',
  'trial',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Workspace agent config
-- ============================================================
INSERT INTO workspace_agent_config (
  id, workspace_id, persona_name, persona_tone, persona_rules,
  response_length, emoji_usage, tratamento, business_info
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Edvan',
  'informal, próximo, usa gírias leves, chama de "mano" e "tranquilo"',
  E'Nunca oferecer descontos não autorizados. Sempre confirmar agendamento antes de finalizar. Não usar linguagem técnica de barbeiro com cliente leigo.',
  'short',
  true,
  'você',
  E'Endereço: Rua das Tesouras, 123 — Centro\nHorário: Ter-Sáb 09h às 19h\nInstagram: @barbearia.edvan'
)
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================================
-- 3. Produtos / Serviços (5)
-- ============================================================
INSERT INTO products (id, workspace_id, name, description, price, duration_minutes, category, is_active)
VALUES
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Corte masculino', 'Corte de cabelo masculino — tesoura ou máquina', 45.00, 30, 'corte', true),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Barba', 'Barba feita na navalha com toalha quente', 25.00, 20, 'barba', true),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Loiro (descoloração)', 'Descoloração capilar masculina', 200.00, 120, 'quimica', true),
  ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Hidratação', 'Hidratação capilar com produtos profissionais', 80.00, 45, 'tratamento', true),
  ('30000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'Sobrancelha', 'Design de sobrancelha masculina', 15.00, 10, 'estetica', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Knowledge tags globais (4) — @workspace.*
-- ============================================================
INSERT INTO knowledge_base (id, workspace_id, tag, title, content, content_type, is_global, is_indexed)
VALUES
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '@workspace.profile', 'Perfil da Barbearia',
   E'Barbearia Edvan — atendemos no Centro, na Rua das Tesouras, 123.\nHorário: Terça a Sábado, 09h às 19h. Domingo e Segunda fechado.\nInstagram: @barbearia.edvan\nAceitamos PIX, cartão e dinheiro.',
   'text', true, false),

  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   '@workspace.persona', 'Persona do agente Edvan',
   E'Edvan é o atendente virtual da barbearia. Estilo informal, brasileiro, usa gírias leves ("tranquilo", "show", "fechou"). Trata cliente por "você" mas com proximidade. Usa emojis com moderação (✂️ 💈 ✅). Nunca é robótico — conduz a conversa como um amigo que entende do salão.',
   'text', true, false),

  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   '@workspace.rules', 'Regras invioláveis',
   E'1. Nunca oferecer descontos não autorizados.\n2. Sempre confirmar horário e serviço antes de finalizar agendamento.\n3. Em caso de cliente irritado, escalar para humano (handoff).\n4. Nunca prometer prazo de execução menor que o duration_minutes do serviço.\n5. Se cliente pedir algo fora do escopo (ex: produto para revenda), explicar que não temos.',
   'text', true, false),

  ('40000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   '@workspace.catalog', 'Catálogo resumido',
   E'Serviços disponíveis: Corte (R$45), Barba (R$25), Loiro/Descoloração (R$200), Hidratação (R$80), Sobrancelha (R$15). Combo Corte+Barba popular. Loiro requer agendamento prévio (procedimento longo, 2h).',
   'text', true, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Fluxo "Agendamento" + 5 nós + 4 edges
-- ============================================================
INSERT INTO flows (id, workspace_id, name, description, trigger_keywords, status, is_default, version)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Agendamento',
  'Fluxo padrão de agendamento de serviço',
  ARRAY['agendar', 'horario', 'marcar', 'corte', 'barba'],
  'active',
  true,
  1
)
ON CONFLICT (id) DO NOTHING;

-- Nós (5)
INSERT INTO flow_nodes (id, flow_id, type, label, config)
VALUES
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'step', 'entry',
   '{"objective":"Cumprimentar e descobrir intenção","knowledge_tags":["@workspace.profile","@workspace.persona"],"awaits_response":true,"allow_digression":true,"context_window":{"include_client_memory":true,"message_history_limit":10,"include_full_catalog":false},"llm_config":{"model":"claude-sonnet","temperature":0.7}}'::jsonb),

  ('52000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'step', 'identifica_servico',
   '{"objective":"Identificar qual serviço o cliente quer","knowledge_tags":["@workspace.catalog"],"awaits_response":true,"allow_digression":true,"context_window":{"include_client_memory":true,"message_history_limit":10,"include_full_catalog":true},"llm_config":{"model":"claude-sonnet","temperature":0.6}}'::jsonb),

  ('53000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'tool_call', 'escolhe_horario',
   '{"tool_id":"buscar_horarios_livres","param_mapping":{"workspace_id":"workspace.id","servico_id":"session.servico_id"},"response_variable":"horarios_disponiveis","generate_response":true}'::jsonb),

  ('54000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'step', 'confirma',
   '{"objective":"Confirmar horário e serviço escolhidos com o cliente","knowledge_tags":["@workspace.rules"],"awaits_response":true,"allow_digression":false,"context_window":{"include_client_memory":true,"message_history_limit":6,"include_full_catalog":false},"llm_config":{"model":"claude-sonnet","temperature":0.5}}'::jsonb),

  ('55000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'tool_call', 'agendado',
   '{"tool_id":"criar_agendamento","param_mapping":{"workspace_id":"workspace.id","cliente_id":"client.id","servico_id":"session.servico_id","horario":"session.horario_escolhido"},"response_variable":"agendamento_id","generate_response":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Edges (4)
INSERT INTO flow_edges (id, flow_id, source_node_id, target_node_id, label, is_default)
VALUES
  ('5e000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001',
   'cliente quer agendar', true),
  ('5e000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
   '52000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001',
   'serviço identificado', true),
  ('5e000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   '53000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001',
   'horário escolhido', true),
  ('5e000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001',
   '54000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001',
   'cliente confirmou', true)
ON CONFLICT (id) DO NOTHING;

-- Tags de knowledge associadas a cada nó step
INSERT INTO node_knowledge_tags (node_id, knowledge_tag)
VALUES
  ('51000000-0000-0000-0000-000000000001', '@workspace.profile'),
  ('51000000-0000-0000-0000-000000000001', '@workspace.persona'),
  ('52000000-0000-0000-0000-000000000001', '@workspace.catalog'),
  ('54000000-0000-0000-0000-000000000001', '@workspace.rules')
ON CONFLICT DO NOTHING;

-- Allowlist de tools para o fluxo
INSERT INTO flow_tool_policies (flow_id, tool_id, allowed)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'buscar_horarios_livres', true),
  ('50000000-0000-0000-0000-000000000001', 'criar_agendamento', true),
  ('50000000-0000-0000-0000-000000000001', 'cancelar_agendamento', true),
  ('50000000-0000-0000-0000-000000000001', 'buscar_historico_cliente', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Clientes de teste (3) com memória semântica populada
-- ============================================================
INSERT INTO clients (id, workspace_id, phone, name, email, crm_status, crm_tags)
VALUES
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '+5511988880001', 'João Silva', 'joao@example.com', 'active', ARRAY['frequente', 'corte_mensal']),
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   '+5511988880002', 'Maria Souza', 'maria@example.com', 'new', ARRAY['interesse_loiro']),
  ('60000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   '+5511988880003', 'Carlos Pereira', NULL, 'active', ARRAY['combo_corte_barba'])
ON CONFLICT (workspace_id, phone) DO NOTHING;

INSERT INTO client_memory (
  id, client_id, workspace_id,
  memory_summary, preferred_name, preferences, last_service, observations, raw_insights
)
VALUES
  ('70000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Cliente frequente desde jan/2025. Faz corte mensalmente, prefere degradê. Atende com Carlos. Tom casual, gosta de papo curto.',
   'João',
   '["corte degradê", "atendimento com Carlos", "horário noturno"]'::jsonb,
   'Corte masculino degradê — 2026-04-10',
   'Sensível a esperas longas. Responde bem a confirmações rápidas.',
   '{"total_visitas": 8, "ticket_medio": 45.00, "ultimo_profissional": "Carlos"}'::jsonb),

  ('70000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'Perguntou sobre loiro 2x mas ainda não fez. Tom mais formal. Demonstrou preocupação com preço.',
   'Maria',
   '["interesse em loiro", "ainda não converteu"]'::jsonb,
   NULL,
   'Sensível a preço. Boa candidata a oferta combinada (loiro + hidratação).',
   '{"total_visitas": 0, "objecoes_registradas": ["preço"], "interesse_pendente": "loiro"}'::jsonb),

  ('70000000-0000-0000-0000-000000000003',
   '60000000-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111',
   'Sempre faz combo corte + barba. Mensal. Tom muito informal, usa gírias. Indicou 2 amigos.',
   'Carlão',
   '["combo corte+barba", "atendimento sábado pela manhã"]'::jsonb,
   'Corte + Barba — 2026-04-20',
   'Cliente promotor (NPS alto). Trata como amigo da casa.',
   '{"total_visitas": 12, "ticket_medio": 70.00, "indicacoes_feitas": 2}'::jsonb)
ON CONFLICT (client_id, workspace_id) DO NOTHING;

-- ============================================================
-- 7. Channel config (YCloud)
-- ============================================================
INSERT INTO channel_configs (id, workspace_id, channel_type, credentials, phone_number, is_active)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'ycloud',
  '{"api_key": "PLACEHOLDER_REPLACE_BEFORE_PROD", "webhook_secret": "PLACEHOLDER_HMAC_SECRET"}'::jsonb,
  '+5511999999999',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Workspace cost cap default
-- ============================================================
INSERT INTO workspace_cost_caps (workspace_id, monthly_cap_usd, current_month_usd, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  100.00,
  0.00,
  'ok'
)
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================================
-- Tools registry (5 tools da fase 1)
-- ============================================================
INSERT INTO tools_registry (
  tool_id, name, description, category,
  params_schema, returns_schema, requires_confirmation, is_active
)
VALUES
  ('buscar_horarios_livres', 'Buscar horários livres',
   'Lista os horários disponíveis para um serviço em uma data',
   'scheduling',
   '{"type":"object","required":["workspace_id","servico_id"],"properties":{"workspace_id":{"type":"string"},"servico_id":{"type":"string"},"data":{"type":"string","format":"date"}}}'::jsonb,
   '{"type":"object","properties":{"slots":{"type":"array","items":{"type":"string","format":"date-time"}}}}'::jsonb,
   false, true),

  ('criar_agendamento', 'Criar agendamento',
   'Cria um agendamento para o cliente',
   'scheduling',
   '{"type":"object","required":["workspace_id","cliente_id","servico_id","horario"],"properties":{"workspace_id":{"type":"string"},"cliente_id":{"type":"string"},"servico_id":{"type":"string"},"horario":{"type":"string","format":"date-time"}}}'::jsonb,
   '{"type":"object","properties":{"agendamento_id":{"type":"string"},"confirmacao":{"type":"string"}}}'::jsonb,
   true, true),

  ('cancelar_agendamento', 'Cancelar agendamento',
   'Cancela um agendamento existente',
   'scheduling',
   '{"type":"object","required":["agendamento_id"],"properties":{"agendamento_id":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"success":{"type":"boolean"}}}'::jsonb,
   true, true),

  ('buscar_historico_cliente', 'Buscar histórico do cliente',
   'Retorna o histórico de agendamentos de um cliente',
   'crm',
   '{"type":"object","required":["workspace_id","telefone"],"properties":{"workspace_id":{"type":"string"},"telefone":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"agendamentos":{"type":"array"},"total_visitas":{"type":"integer"},"ultimo_servico":{"type":"string"}}}'::jsonb,
   false, true),

  ('registrar_ou_atualizar_cliente', 'Registrar ou atualizar cliente',
   'Cria ou atualiza dados de um cliente',
   'crm',
   '{"type":"object","required":["workspace_id","dados"],"properties":{"workspace_id":{"type":"string"},"dados":{"type":"object"}}}'::jsonb,
   '{"type":"object","properties":{"cliente_id":{"type":"string"}}}'::jsonb,
   false, true)
ON CONFLICT (tool_id) DO NOTHING;
