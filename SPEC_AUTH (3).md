# SPEC_AUTH.md
## GM Controller — Autenticação e Perfis
**Versão:** 1.0  
**Stack:** Supabase Auth + Next.js App Router + Middleware  
**Depende de:** SPEC_DATABASE.md (tabela `profiles`, trigger `create_profile_for_user`)

---

## 1. VISÃO GERAL

A plataforma tem três perfis com experiências completamente distintas:

| Perfil | Quem é | O que pode fazer |
|---|---|---|
| `player` | Jogador comum | Entrar em sessões via convite, gerenciar personagens, ver ficha em tempo real |
| `gm` | Mestre de Mesa | Tudo do player + criar sessões, controlar partidas, usar painel do GM |
| `admin` | Administrador | Tudo do GM + gerenciar usuários, promover roles, ver métricas |

Todo usuário nasce como `player`. Role `gm` é auto-atribuído no primeiro cadastro (configurável via env var `NEXT_PUBLIC_GM_OPEN_REGISTRATION`). Role `admin` só via service role no banco.

---

## 2. FLUXOS DE AUTENTICAÇÃO

### 2.1 Cadastro
1. Usuário acessa `/register`
2. Preenche: nome, email, senha
3. Supabase cria o usuário em `auth.users`
4. Trigger `create_profile_for_user` cria o perfil em `profiles` com `role = 'player'`
5. Se `NEXT_PUBLIC_GM_OPEN_REGISTRATION=true`, role é promovido para `gm` automaticamente
6. Redireciona para `/dashboard`

**Campos obrigatórios:**
- `display_name` — string, mínimo 2 caracteres
- `email` — email válido, único
- `password` — mínimo 8 caracteres

### 2.2 Login
1. Usuário acessa `/login`
2. Preenche email e senha
3. Supabase retorna session + user
4. Sistema busca `profiles` pelo `user.id` para obter o `role`
5. Redireciona baseado no role:
   - `admin` → `/admin`
   - `gm` → `/dashboard`
   - `player` → `/play`

### 2.3 Entrar via Convite
1. Jogador recebe link: `/join/[invite_code]`
2. Se não está logado → redireciona para `/login?redirect=/join/[invite_code]`
3. Se está logado → sistema valida o `invite_code` na tabela `sessions`
4. Cria registro em `session_players` com `status = 'invited'`
5. Redireciona para `/play/[session_id]`

### 2.4 Logout
- Endpoint: `/api/auth/logout`
- Limpa cookies de sessão do Supabase
- Redireciona para `/login`

### 2.5 Recuperação de Senha
- Fluxo padrão do Supabase via email
- Página `/reset-password` para definir nova senha

---

## 3. ROTAS E PROTEÇÃO

### 3.1 Estrutura de Rotas

```
/                     → redireciona baseado em auth
/login                → pública
/register             → pública
/join/[invite_code]   → pública (redireciona para login se não autenticado)
/reset-password       → pública

/dashboard            → protegida (gm, admin)
/dashboard/sessions   → protegida (gm, admin)
/dashboard/templates  → protegida (gm, admin)
/dashboard/characters → protegida (gm, admin)

/play                 → protegida (player, gm, admin)
/play/[session_id]    → protegida (player, gm, admin) + membro da sessão

/admin                → protegida (admin only)
/admin/users          → protegida (admin only)

/api/auth/*           → handlers de auth
```

### 3.2 Middleware de Proteção

Arquivo: `middleware.ts` na raiz do projeto.

**Lógica:**
```
Request chega
  → Verifica cookie de sessão Supabase
  → Se não autenticado + rota protegida → /login?redirect=[rota]
  → Se autenticado + rota pública (login/register) → /dashboard ou /play
  → Se autenticado + rota protegida → verifica role
    → Role insuficiente → /unauthorized
  → Passa adiante
```

**Matcher** (rotas que o middleware intercepta):
```
/(dashboard|play|admin|api/auth)(.*)
```

---

## 4. CONTEXTO DE AUTH NO CLIENTE

### 4.1 Provider
Arquivo: `components/providers/AuthProvider.tsx`

Expõe via Context:
```typescript
{
  user: User | null
  profile: Profile | null
  role: Role | null
  isLoading: boolean
  signOut: () => Promise<void>
}
```

### 4.2 Hook
```typescript
// hooks/useAuth.ts
const { user, profile, role, isLoading, signOut } = useAuth()
```

### 4.3 Hook de Proteção por Role
```typescript
// hooks/useRequireRole.ts
useRequireRole('gm') // redireciona se role insuficiente
```

---

## 5. PÁGINAS DE AUTH

### 5.1 `/login`
- Campos: email, senha
- Link para `/register`
- Link para recuperação de senha
- Após login: redireciona para `?redirect` param ou baseado em role
- Estilo: dark, mobile-first, consistente com o app

### 5.2 `/register`
- Campos: nome, email, senha, confirmação de senha
- Validação client-side antes de submeter
- Após cadastro: redireciona para `/dashboard` (gm) ou `/play` (player)
- Estilo: dark, mobile-first

### 5.3 `/join/[invite_code]`
- Valida o código
- Se sessão não existe → erro "Convite inválido"
- Se sessão está `finished` → erro "Esta partida já encerrou"
- Se usuário já é membro → redireciona direto para `/play/[session_id]`
- Se OK → cria `session_players` e redireciona

### 5.4 `/unauthorized`
- Página simples explicando que o usuário não tem permissão
- Botão de voltar

---

## 6. HELPERS DE SERVER-SIDE AUTH

### 6.1 Client Supabase para Server Components
Arquivo: `lib/supabase-server.ts`

```typescript
// Usa @supabase/ssr createServerClient com cookies
export function createServerClient()
```

### 6.2 Função getProfile
Arquivo: `lib/auth.ts`

```typescript
// Busca user + profile em Server Components e Route Handlers
export async function getProfile(): Promise<{ user: User; profile: Profile } | null>
```

### 6.3 Função requireRole
```typescript
// Usa em Server Components — redireciona se role insuficiente
export async function requireRole(role: Role): Promise<{ user: User; profile: Profile }>
```

---

## 7. VARIÁVEIS DE AMBIENTE

```env
# Já existentes
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Novas
SUPABASE_SERVICE_ROLE_KEY=        # para operações admin server-side
NEXT_PUBLIC_GM_OPEN_REGISTRATION= # 'true' = qualquer cadastro vira GM
NEXT_PUBLIC_APP_URL=              # URL base do app (para links de convite)
```

---

## 8. SEGURANÇA

- Senha nunca trafega fora do Supabase Auth
- `SUPABASE_SERVICE_ROLE_KEY` apenas em server-side (nunca exposta ao cliente)
- Role verificado tanto no middleware (Next.js) quanto no RLS (Supabase) — dupla camada
- Tokens de sessão nos cookies com `httpOnly` e `secure` via `@supabase/ssr`
- Invite codes são de 8 chars alfanuméricos — suficiente para uso privado

---

## 9. ARQUIVOS A CRIAR

```
middleware.ts                           ← proteção de rotas
lib/supabase-server.ts                  ← client server-side
lib/auth.ts                             ← getProfile, requireRole
hooks/useAuth.ts                        ← hook de auth
hooks/useRequireRole.ts                 ← hook de proteção
components/providers/AuthProvider.tsx   ← context provider
app/(auth)/login/page.tsx               ← página de login
app/(auth)/register/page.tsx            ← página de cadastro
app/(auth)/layout.tsx                   ← layout das páginas de auth
app/join/[invite_code]/page.tsx         ← página de convite
app/unauthorized/page.tsx               ← página de erro de permissão
app/api/auth/logout/route.ts            ← endpoint de logout
```
