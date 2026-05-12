# SPEC_ONBOARDING_BUSINESS_PROFILE.md
## Yadone — Onboarding: "Conte sobre o seu negócio"
**Versão:** 1.0
**Quando:** Após cadastro e pagamento, primeira etapa do onboarding
**Objetivo principal:** Montar a knowledge base da IA com dados reais do negócio
**API:** Google Places API (New)

---

## 1. CONTEXTO

Essa etapa substitui/complementa a etapa `agent_pending` do onboarding definido no SPEC_AUTH.md.

Fluxo geral do onboarding:
```
Cadastro + Pagamento
  → [ESTA ETAPA] Perfil do negócio (Google Places)
  → Configurar agente (persona, tom)
  → Conectar WhatsApp
  → Criar primeiro produto
  → Dashboard
```

---

## 2. FLUXO COMPLETO DA ETAPA

### 2.1 Tela inicial

```
┌─────────────────────────────────────────────────┐
│                                                  │
│   Conte sobre o seu negócio                     │
│                                                  │
│   Vamos encontrar sua farmácia para preencher   │
│   seu perfil automaticamente.                   │
│                                                  │
│   [🔍 Digite o nome do seu negócio...    ]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 2.2 Busca em tempo real (autocomplete)

Enquanto o usuário digita (debounce 400ms):
- Chama **Places Autocomplete API** com os termos digitados
- Filtra por tipo `establishment` no Brasil (`componentRestrictions: { country: 'br' }`)
- Exibe dropdown com até 5 resultados

```
[🔍 Farmácia São João           ]
┌─────────────────────────────────┐
│ 🏥 Farmácia São João            │
│    Rua das Flores, 123 - SP     │
│                                  │
│ 🏥 Farmácia São João            │
│    Av. Brasil, 456 - RJ         │
│                                  │
│ 🏥 Farmácias São João (Rede)    │
│    12 unidades encontradas       │
│                                  │
│ 🔍 Buscar por "Farmácia São..." │
└─────────────────────────────────┘
```

Cada item mostra: nome + endereço resumido + quantidade de unidades (se rede).

### 2.3 Seleção e carregamento

Ao clicar em uma opção:
1. Loading state no card selecionado
2. Chama **Place Details API** com `place_id`
3. Busca todos os campos disponíveis (ver seção 4)

### 2.4 Detecção de múltiplas unidades

**Como detectar rede:**
- A Places API retorna várias localizações com o mesmo nome
- Se a busca retornar 2+ resultados com nome idêntico → é uma rede
- Buscar todas as unidades via **Nearby Search** ou **Text Search** com o mesmo nome

**Pergunta ao usuário (se rede detectada):**
```
┌─────────────────────────────────────────────────┐
│ Encontramos 12 unidades de Farmácia São João   │
│                                                  │
│ Você é proprietário de quantas unidades?        │
│                                                  │
│ ○ Só desta unidade                              │
│   Rua das Flores, 123 - São Paulo               │
│                                                  │
│ ○ De algumas unidades específicas               │
│   [Selecionar quais →]                          │
│                                                  │
│ ○ De todas as 12 unidades                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Se "algumas unidades específicas":**
- Mostrar lista com checkbox de todas as unidades encontradas
- Cada item: nome da unidade + endereço + cidade

### 2.5 Perfil montado automaticamente

Após seleção, mostrar preview dos dados encontrados:

```
┌─────────────────────────────────────────────────┐
│ ✅ Encontramos seu negócio!                      │
│                                                  │
│ FARMÁCIA SÃO JOÃO                               │
│ ⭐ 4.8 (312 avaliações)                         │
│                                                  │
│ 📍 Endereço                                     │
│ Rua das Flores, 123 - Jardim Europa             │
│ São Paulo - SP, 01234-567                        │
│                                                  │
│ 🕐 Horários                                     │
│ Seg-Sex: 07h às 22h                             │
│ Sábado: 08h às 20h                              │
│ Domingo: 09h às 18h                             │
│                                                  │
│ 📞 (11) 3456-7890                               │
│ 🌐 farmaciasaojoao.com.br                        │
│                                                  │
│ 🏥 Categorias                                   │
│ Farmácia · Drogaria · Manipulação               │
│                                                  │
│ 📦 Produtos/Serviços identificados              │
│ Medicamentos · Perfumaria · Manipulação         │
│ Dermocosméticos · Produtos naturais             │
│                                                  │
│ [✏️ Editar informações]  [Confirmar →]          │
└─────────────────────────────────────────────────┘
```

### 2.6 Negócio não encontrado

Se não aparecer nenhum resultado após 3+ caracteres:

```
┌─────────────────────────────────────────────────┐
│ 🔍 Nenhum negócio encontrado com esse nome.    │
│                                                  │
│ Isso acontece com negócios novos ou com nome   │
│ diferente no Google.                            │
│                                                  │
│ [Preencher manualmente →]                       │
└─────────────────────────────────────────────────┘
```

Formulário manual (campos obrigatórios marcados):
- Nome do negócio *
- Endereço *
- Cidade / Estado *
- Telefone
- Site
- Horário de funcionamento
- Produtos/serviços (textarea livre)
- Número de unidades *

### 2.7 Edição antes de confirmar

Antes de salvar, o usuário pode editar qualquer campo pré-preenchido. Campos editáveis inline (click para editar).

---

## 3. O QUE SALVAR NO BANCO

### 3.1 Tabela `workspaces` (campos novos)

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS
  business_name        TEXT,
  google_place_id      TEXT,          -- para re-buscar depois se precisar
  google_places_data   JSONB,         -- snapshot completo da Places API
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  zip_code             TEXT,
  phone                TEXT,
  website              TEXT,
  business_hours       JSONB,         -- { mon: {open:'07:00', close:'22:00'}, ... }
  categories           TEXT[],        -- ['Farmácia', 'Drogaria']
  services             TEXT[],        -- ['Manipulação', 'Dermocosméticos']
  rating               NUMERIC(2,1),  -- 4.8
  review_count         INTEGER,       -- 312
  logo_url             TEXT,          -- foto principal da Place
  unit_count           INTEGER,       -- quantas unidades o owner declarou
  is_chain             BOOLEAN DEFAULT false,
  onboarding_status    TEXT           -- já existe no spec, atualizar para 'business_complete'
```

### 3.2 Tabela `workspace_units` (nova — para redes)

```sql
CREATE TABLE IF NOT EXISTS workspace_units (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  google_place_id  TEXT,
  name             TEXT NOT NULL,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  phone            TEXT,
  business_hours   JSONB,
  is_primary       BOOLEAN DEFAULT false,  -- unidade principal
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Knowledge Base (o mais importante)

Após confirmar os dados, o sistema monta automaticamente os primeiros chunks de conhecimento na tabela `knowledge_base`:

```typescript
// Chunks gerados automaticamente:

[1] IDENTIDADE DO NEGÓCIO
"A Farmácia São João é uma farmácia localizada na Rua das Flores, 123,
Jardim Europa, São Paulo - SP. Telefone: (11) 3456-7890.
Site: farmaciasaojoao.com.br."

[2] HORÁRIOS DE FUNCIONAMENTO
"A Farmácia São João funciona de segunda a sexta das 07h às 22h,
aos sábados das 08h às 20h e aos domingos das 09h às 18h."

[3] PRODUTOS E SERVIÇOS
"A Farmácia São João oferece: medicamentos, perfumaria, manipulação
de fórmulas, dermocosméticos e produtos naturais."

[4] AVALIAÇÕES E REPUTAÇÃO
"A Farmácia São João possui avaliação de 4.8 estrelas no Google,
com 312 avaliações de clientes."

[5] UNIDADES (se rede)
"A Farmácia São João possui 3 unidades: [lista de endereços]."
```

Cada chunk vai para `knowledge_base` com:
- `workspace_id`
- `title` (ex: "Identidade do Negócio")
- `content` (texto gerado)
- `source` = 'google_places_onboarding'
- `is_active` = true

---

## 4. DADOS PUXADOS DA PLACES API

### 4.1 Fields a solicitar no Place Details

```javascript
const PLACE_DETAIL_FIELDS = [
  // Básico
  'name',
  'place_id',
  'formatted_address',
  'address_components',  // para separar rua/cidade/estado/cep
  'geometry',            // lat/lng

  // Contato
  'formatted_phone_number',
  'international_phone_number',
  'website',

  // Horários
  'opening_hours',       // { weekday_text, periods }
  'current_opening_hours',

  // Qualidade
  'rating',
  'user_ratings_total',
  'reviews',             // até 5 mais recentes

  // Categorias
  'types',               // ['pharmacy', 'health', 'store']
  'business_status',

  // Visual
  'photos',              // até 10 fotos

  // Outros
  'price_level',
  'serves_beer',         // irrelevante para farmácia, ignorar
]
```

### 4.2 Mapeamento de `types` do Google para categorias legíveis

```typescript
const GOOGLE_TYPE_MAP: Record<string, string> = {
  pharmacy:           'Farmácia',
  drugstore:          'Drogaria',
  health:             'Saúde',
  store:              'Loja',
  establishment:      null,  // ignorar
  point_of_interest:  null,  // ignorar
}
```

---

## 5. IMPLEMENTAÇÃO TÉCNICA

### 5.1 API Route (server-side — chave nunca exposta)

```
GET /api/onboarding/places/search?q={query}
→ Chama Places Autocomplete API
→ Retorna: [{ place_id, name, address, description }]

GET /api/onboarding/places/details?place_id={id}
→ Chama Place Details API
→ Retorna: dados completos mapeados

GET /api/onboarding/places/units?name={name}&location={lat,lng}
→ Chama Text Search API buscando todas as unidades de uma rede
→ Retorna: [{ place_id, name, address, city }]
```

**Importante:** A chave da Google Places API fica APENAS no servidor (`.env.local` como `GOOGLE_PLACES_API_KEY`). Nunca expor no client com prefixo `NEXT_PUBLIC_`.

### 5.2 Componente de busca (client)

```typescript
// components/onboarding/BusinessSearch.tsx
// - Input com debounce de 400ms
// - Fetch para /api/onboarding/places/search
// - Dropdown com resultados
// - onSelect → fetch /api/onboarding/places/details
// - Estado: idle | searching | loading_details | found | not_found | manual
```

### 5.3 Server Action de save

```typescript
// app/onboarding/actions.ts
export async function saveBusinessProfile(data: BusinessProfileData) {
  // 1. Auth check
  // 2. UPDATE workspaces SET business_name, address, etc.
  // 3. INSERT workspace_units (se rede)
  // 4. INSERT knowledge_base chunks (auto-gerados)
  // 5. UPDATE workspaces SET onboarding_status = 'business_complete'
  // 6. redirect → próxima etapa do onboarding
}
```

### 5.4 Geração automática dos knowledge chunks

```typescript
// lib/onboarding/knowledge-generator.ts
export function generateBusinessKnowledgeChunks(
  profile: BusinessProfile,
  units: WorkspaceUnit[]
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = []

  // Chunk 1: Identidade
  chunks.push({
    title: 'Identidade do Negócio',
    content: `${profile.name} é uma ${profile.categories[0]} localizada em ${profile.address}...`,
    source: 'google_places_onboarding'
  })

  // Chunk 2: Horários
  if (profile.businessHours) {
    chunks.push({
      title: 'Horários de Funcionamento',
      content: formatBusinessHours(profile.businessHours),
      source: 'google_places_onboarding'
    })
  }

  // Chunk 3: Produtos/Serviços
  if (profile.services?.length) {
    chunks.push({
      title: 'Produtos e Serviços',
      content: `${profile.name} oferece: ${profile.services.join(', ')}.`,
      source: 'google_places_onboarding'
    })
  }

  // Chunk 4: Avaliações
  if (profile.rating) {
    chunks.push({
      title: 'Avaliação e Reputação',
      content: `${profile.name} possui avaliação de ${profile.rating} estrelas no Google com ${profile.reviewCount} avaliações.`,
      source: 'google_places_onboarding'
    })
  }

  // Chunk 5: Unidades (se rede)
  if (units.length > 1) {
    chunks.push({
      title: 'Unidades',
      content: `${profile.name} possui ${units.length} unidades: ${units.map(u => u.address).join('; ')}.`,
      source: 'google_places_onboarding'
    })
  }

  return chunks
}
```

---

## 6. ROTA E ESTRUTURA DE ARQUIVOS

```
app/onboarding/
├── page.tsx                    ← redirect para /onboarding/business
├── business/
│   └── page.tsx                ← esta etapa
├── agent/
│   └── page.tsx                ← próxima etapa
├── whatsapp/
│   └── page.tsx
└── actions.ts                  ← server actions compartilhadas

app/api/onboarding/
└── places/
    ├── search/route.ts         ← autocomplete
    ├── details/route.ts        ← place details
    └── units/route.ts          ← busca de todas as unidades

components/onboarding/
├── BusinessSearch.tsx          ← input + dropdown
├── BusinessPreview.tsx         ← card de confirmação
├── BusinessManualForm.tsx      ← formulário manual
├── UnitSelector.tsx            ← seleção de unidades de redes
└── OnboardingLayout.tsx        ← layout com progress bar

lib/onboarding/
├── knowledge-generator.ts      ← gera chunks de knowledge base
├── places-mapper.ts            ← mapeia resposta da API para tipos internos
└── types.ts                    ← BusinessProfile, WorkspaceUnit, etc.
```

---

## 7. VARIÁVEIS DE AMBIENTE

```bash
# .env.local
GOOGLE_PLACES_API_KEY=AIza...    # nunca NEXT_PUBLIC_

# Opcional: limitar chamadas por IP no Google Console
# Configurar restrições de API Key:
# - Restrição de aplicativo: Servidores HTTP
# - Restrição de API: Places API (New)
```

---

## 8. CUSTOS ESTIMADOS DA API

| Operação | Preço por 1.000 | Volume estimado (100 onboardings) |
|---|---|---|
| Autocomplete per request | $2.83 | ~$0.14 (50 req/usuário) |
| Place Details | $17.00 | ~$1.70 (1 req/usuário) |
| Text Search (busca unidades) | $32.00 | ~$0.32 (10 req/usuário) |
| **Total por 100 onboardings** | | **~$2.16** |

Custo marginal baixíssimo para o volume inicial.

---

## 9. CHECKLIST DE IMPLEMENTAÇÃO

```
□ Criar GOOGLE_PLACES_API_KEY no Google Cloud Console
□ Ativar: Places API (New), Maps JavaScript API
□ Configurar restrição da chave (HTTP referrers ou IP)
□ Adicionar variável no .env.local e na Vercel
□ Migration SQL para novos campos em workspaces
□ Criar tabela workspace_units
□ API routes /api/onboarding/places/*
□ Componentes de onboarding
□ Server action saveBusinessProfile
□ Gerador de knowledge chunks
□ Integrar na ordem do onboarding (onboarding_status)
□ Testar fluxo: busca → seleção → múltiplas unidades → confirmação → knowledge base gerada
□ Testar fluxo manual (negócio não encontrado)
```

---

## 10. FORA DO ESCOPO DESTA SPEC

- Atualização automática dos dados do Google periodicamente (re-sync)
- Puxar reviews do Google para o CRM (fase 2)
- Google My Business API para responder reviews (fase 3)
- Integração com CNPJ/Receita Federal para dados fiscais (fase 2)
