# PROMPT — Onboarding: Perfil do Negócio (Google Places)

Cole isso no Claude Code em **plan mode**.

---

## Leia primeiro

Leia os seguintes arquivos antes de qualquer coisa:
1. `SPEC_ONBOARDING_BUSINESS_PROFILE.md`
2. `SPEC_AUTH.md` (seção 4 — fluxo de onboarding)
3. `app/(app)/layout.tsx` (layout autenticado)
4. `app/settings/actions.ts` (padrão de server actions do projeto)
5. `lib/supabase/server.ts` (clientes Supabase)
6. `supabase/migrations/` — listar os arquivos para saber o próximo número de migration

---

## Objetivo

Implementar a etapa "Conte sobre o seu negócio" do onboarding, que usa a Google Places API para buscar dados do negócio em tempo real, detectar múltiplas unidades, e gerar automaticamente os primeiros chunks da knowledge base da IA.

---

## PARTE 1 — Migration SQL

Crie `supabase/migrations/032_business_profile.sql`:

```sql
-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR

-- Campos novos em workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS business_name       TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id     TEXT,
  ADD COLUMN IF NOT EXISTS google_places_data  JSONB,
  ADD COLUMN IF NOT EXISTS address             TEXT,
  ADD COLUMN IF NOT EXISTS city                TEXT,
  ADD COLUMN IF NOT EXISTS state               TEXT,
  ADD COLUMN IF NOT EXISTS zip_code            TEXT,
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS website             TEXT,
  ADD COLUMN IF NOT EXISTS business_hours      JSONB,
  ADD COLUMN IF NOT EXISTS categories          TEXT[],
  ADD COLUMN IF NOT EXISTS services            TEXT[],
  ADD COLUMN IF NOT EXISTS rating              NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS review_count        INTEGER,
  ADD COLUMN IF NOT EXISTS logo_url            TEXT,
  ADD COLUMN IF NOT EXISTS unit_count          INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_chain            BOOLEAN DEFAULT false;

-- Tabela de unidades (redes)
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
  is_primary       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS em workspace_units
ALTER TABLE workspace_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON workspace_units;
CREATE POLICY "workspace_isolation" ON workspace_units
  USING (workspace_id = get_my_workspace_id());
```

Mostre a migration e **aguarde confirmação** antes de continuar.

---

## PARTE 2 — Variável de ambiente

Verificar se `GOOGLE_PLACES_API_KEY` está no `.env.local`. Se não estiver, instruir o usuário a adicionar:
```
GOOGLE_PLACES_API_KEY=AIza...
```

E adicionar também na Vercel em Settings → Environment Variables.

**NUNCA usar `NEXT_PUBLIC_` nessa chave** — ela fica só server-side.

---

## PARTE 3 — API Routes (server-side)

Crie os 3 endpoints. A chave do Google nunca vai para o client.

### `app/api/onboarding/places/search/route.ts`
```
GET /api/onboarding/places/search?q={query}

- Requer auth (verificar usuário logado)
- Chama Google Places Autocomplete (New):
  https://places.googleapis.com/v1/places:autocomplete
  Body: { input: q, languageCode: 'pt-BR', regionCode: 'BR',
          includedPrimaryTypes: ['establishment'] }
  Header: X-Goog-Api-Key: GOOGLE_PLACES_API_KEY
- Mapear resposta para: [{ place_id, name, address, description }]
- Retornar max 5 resultados
- Cache: 60s (header Cache-Control)
```

### `app/api/onboarding/places/details/route.ts`
```
GET /api/onboarding/places/details?place_id={id}

- Requer auth
- Chama Google Place Details (New):
  https://places.googleapis.com/v1/places/{place_id}
  Header: X-Goog-Api-Key: GOOGLE_PLACES_API_KEY
  Header: X-Goog-FieldMask: id,displayName,formattedAddress,
    addressComponents,nationalPhoneNumber,websiteUri,
    regularOpeningHours,rating,userRatingCount,types,photos
- Mapear para BusinessProfile (ver lib/onboarding/types.ts)
- Pegar primeira foto se disponível (photos[0])
```

### `app/api/onboarding/places/units/route.ts`
```
GET /api/onboarding/places/units?name={name}

- Requer auth
- Chama Google Text Search (New):
  https://places.googleapis.com/v1/places:searchText
  Body: { textQuery: name, languageCode: 'pt-BR', regionCode: 'BR',
          maxResultCount: 20,
          includedType: 'pharmacy' }
  Header: X-Goog-Api-Key
  Header: X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.addressComponents
- Retornar: [{ place_id, name, address, city, state }]
- Filtrar resultados com nome muito diferente do buscado (threshold: nome contém a query)
```

---

## PARTE 4 — Tipos e utilitários

### `lib/onboarding/types.ts`
```typescript
export type BusinessProfile = {
  placeId: string
  name: string
  address: string
  city: string
  state: string
  zipCode?: string
  phone?: string
  website?: string
  businessHours?: BusinessHours
  categories: string[]
  services: string[]
  rating?: number
  reviewCount?: number
  logoUrl?: string
  rawData?: Record<string, unknown>  // snapshot da Places API
}

export type BusinessHours = {
  mon?: DayHours
  tue?: DayHours
  wed?: DayHours
  thu?: DayHours
  fri?: DayHours
  sat?: DayHours
  sun?: DayHours
  text?: string[]  // weekday_text do Google
}

export type DayHours = { open: string; close: string }

export type WorkspaceUnit = {
  placeId?: string
  name: string
  address: string
  city: string
  state: string
  phone?: string
  businessHours?: BusinessHours
  isPrimary: boolean
}

export type BusinessProfileData = {
  profile: BusinessProfile
  units: WorkspaceUnit[]
  isChain: boolean
  unitCount: number
  manualEntry: boolean
}
```

### `lib/onboarding/places-mapper.ts`
Exporta funções:
- `mapPlaceDetailsToProfile(raw: unknown): BusinessProfile`
  - Mapear `addressComponents` para city/state/zipCode separados
  - Mapear `types` para categorias legíveis (usar GOOGLE_TYPE_MAP do spec)
  - Mapear `regularOpeningHours.periods` para BusinessHours
  - Inferir `services` a partir dos `types` (pharmacy → Medicamentos, etc.)
- `mapWeekdayText(periods: unknown[]): BusinessHours`
- `formatBusinessHoursText(hours: BusinessHours): string`
  - Retorna string legível: "Seg-Sex: 07h às 22h, Sáb: 08h às 20h"

### `lib/onboarding/knowledge-generator.ts`
Exporta `generateBusinessKnowledgeChunks(profile, units)` conforme spec seção 3.3.

Retorna array de `{ title, content, source: 'google_places_onboarding' }`.

---

## PARTE 5 — Server Action

### `app/onboarding/actions.ts` (criar)
```typescript
'use server'

export async function saveBusinessProfile(data: BusinessProfileData): Promise<{ success: boolean; error?: string }>

// Lógica:
// 1. Auth check
// 2. Pegar workspace_id do usuário
// 3. UPDATE workspaces SET business_name, google_place_id, address, city,
//    state, phone, website, business_hours, categories, services, rating,
//    review_count, logo_url, unit_count, is_chain, google_places_data
// 4. Se is_chain e units.length > 1:
//    INSERT INTO workspace_units (múltiplos)
//    Marcar isPrimary no primeiro
// 5. Gerar knowledge chunks via generateBusinessKnowledgeChunks()
// 6. INSERT INTO knowledge_base (múltiplos chunks)
//    Campos: workspace_id, title, content, source='google_places_onboarding', is_active=true
//    Verificar schema da tabela knowledge_base antes de inserir
// 7. UPDATE workspaces SET onboarding_status = 'agent_pending'
//    (avança para a próxima etapa)
// 8. revalidatePath('/onboarding')
// 9. Retornar { success: true }
```

---

## PARTE 6 — Componentes

### `components/onboarding/BusinessSearch.tsx` (client)
- Input com debounce 400ms (usar setTimeout/clearTimeout, sem lib extra)
- Estados: `idle | searching | loading_details | found | not_found | manual`
- Fetch para `/api/onboarding/places/search?q=`
- Dropdown com até 5 resultados (position absolute, z-50)
- Cada item: nome + endereço + click seleciona
- Ao selecionar: fetch `/api/onboarding/places/details?place_id=`
- Loading skeleton no dropdown enquanto busca
- Se nenhum resultado após 3+ chars: mostrar "Negócio não encontrado" + link para modo manual
- AbortController para cancelar fetches anteriores ao digitar

### `components/onboarding/BusinessPreview.tsx` (client)
- Card mostrando todos os dados encontrados
- Cada campo editável inline (click → input, blur → salva no estado local)
- Campos: nome, endereço, telefone, site, horários, categorias, avaliação
- Botão "Editar informações" abre todos os campos
- Botão "Confirmar →" chama `saveBusinessProfile()`
- Loading state no botão durante save

### `components/onboarding/UnitSelector.tsx` (client)
- Props: `{ units: WorkspaceUnit[]; onSelect: (selected: WorkspaceUnit[]) => void }`
- 3 opções: "Só esta unidade" | "Algumas unidades" | "Todas as N unidades"
- Se "Algumas": lista com checkbox por unidade (nome + endereço + cidade)
- Botão "Confirmar seleção"

### `components/onboarding/BusinessManualForm.tsx` (client)
- Formulário completo conforme spec seção 2.6
- Campos: nome*, endereço*, cidade*, estado*, telefone, site, horários (textarea), serviços (textarea), nº de unidades*
- Submit chama `saveBusinessProfile()` com `manualEntry: true`
- Sem chamada à Places API

### `components/onboarding/OnboardingProgress.tsx` (client)
- Barra de progresso com 4 etapas: Negócio → Agente → WhatsApp → Produtos
- Props: `{ currentStep: 1 | 2 | 3 | 4 }`
- Etapa ativa destacada, concluídas com ✓

---

## PARTE 7 — Página

### `app/onboarding/business/page.tsx` (server component)
- Auth check: se não autenticado → redirect `/login`
- Buscar workspace do usuário
- Se `onboarding_status === 'business_complete'` → redirect `/onboarding/agent`
- Se `onboarding_status === 'complete'` → redirect `/conversations`
- Renderizar `<OnboardingProgress currentStep={1} />`
- Renderizar `<BusinessSearch />` ou `<BusinessPreview />` conforme estado
- Layout: centralizado, max-w-2xl, sem sidebar (onboarding é fora do app autenticado)

### `app/onboarding/page.tsx`
- redirect para `/onboarding/business`

---

## REGRAS DE IMPLEMENTAÇÃO

1. **GOOGLE_PLACES_API_KEY nunca no client** — só nas API routes server-side
2. **TypeScript estrito** — sem `any`
3. **AbortController** em todos os fetches do cliente para evitar race conditions
4. **Graceful fallback** — se a Places API falhar, não quebrar o onboarding; mostrar modo manual
5. **Verificar schema real** de `knowledge_base` antes de inserir (ler a migration existente)
6. **Verificar schema real** de `workspaces` para saber colunas que já existem
7. **Sem libs novas** — debounce com setTimeout, sem lodash/axios/swr
8. **Mobile-first** — onboarding funciona em 390px
9. **`npx tsc --noEmit`** no final sem erros
10. **`npm run build`** no final sem erros

---

## O QUE NÃO FAZER

- Não expor `GOOGLE_PLACES_API_KEY` com `NEXT_PUBLIC_`
- Não chamar a Places API direto do client (sempre via API route)
- Não modificar migrations existentes (001-031)
- Não instalar @googlemaps/js-api-loader ou similar — usar fetch nativo
- Não modificar o fluxo de auth ou settings existente

---

## ANTES DE IMPLEMENTAR

Mostre o plano completo dividido em:
1. Migration SQL (mostrar conteúdo completo)
2. API routes a criar
3. Tipos e utilitários
4. Server action
5. Componentes
6. Página

Pergunte se pode prosseguir.
