// lib/guardrails/content-filter-output.ts — Filtra padrões sensíveis no output final.
// SPEC §14.8.
// filterOutput(text, ctx?) → OutputFilterResult
// Nunca throws — retorna safe:true em falha interna.

import { logAudit } from '@/lib/db/audit'
import type { OutputFilterResult } from '@/types/guardrails'

interface FilterContext {
  workspace_id?: string | null
  session_id?: string | null
  client_id?: string | null
  trace_id?: string | null
}

interface PatternDef {
  name: string
  pattern: RegExp
}

const BLOCKED_PATTERNS: PatternDef[] = [
  // API keys / tokens
  { name: 'api_key_sk', pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'bearer_token', pattern: /Bearer [a-zA-Z0-9]{20,}/ },
  { name: 'anthropic_key', pattern: /anthropic_/i },
  { name: 'openai_key', pattern: /openai_/i },

  // Database errors / internals
  { name: 'db_postgresql', pattern: /PostgreSQL/ },
  { name: 'db_supabase', pattern: /supabase/ },
  { name: 'db_table', pattern: /\btable\s+['"`]?\w/ },
  { name: 'db_column', pattern: /\bcolumn\s+['"`]?\w/ },

  // Stack traces
  { name: 'stack_trace_at', pattern: /at \w+ \(.+:\d+:\d+\)/ },
  { name: 'stack_trace_error', pattern: /Error:\s+\w+/ },

  // Path leaks
  { name: 'path_users', pattern: /\/Users\// },
  { name: 'path_home', pattern: /\/home\// },
  { name: 'path_var', pattern: /\/var\// },
  { name: 'path_windows', pattern: /C:\\\\/ },

  // Persona break
  { name: 'persona_as_ai', pattern: /As an AI/i },
  { name: 'persona_i_am_ai', pattern: /I am an AI/i },

  // Prompt residue
  { name: 'prompt_system_section', pattern: /SYSTEM:|SECTION \d+|═══/ },
]

/**
 * Detecta padrões sensíveis ou perigosos no texto de output.
 * Em block, registra audit e retorna safe:false.
 * Caller deve forçar handoff se safe=false.
 */
export async function filterOutput(
  text: string,
  ctx: FilterContext = {},
): Promise<OutputFilterResult> {
  try {
    for (const { name, pattern } of BLOCKED_PATTERNS) {
      if (pattern.test(text)) {
        void logAudit(
          'guardrail.output_filtered',
          {
            pattern: name,
            ctx,
          },
          {
            workspace_id: ctx.workspace_id ?? undefined,
            session_id: ctx.session_id ?? undefined,
            client_id: ctx.client_id ?? undefined,
            trace_id: ctx.trace_id ?? undefined,
          },
        )
        return {
          safe: false,
          layer: 'output_filter',
          pattern_matched: name,
        }
      }
    }

    return { safe: true, layer: 'output_filter' }
  } catch (e) {
    console.error('[guardrails/content-filter-output] unexpected error', (e as Error).message)
    return { safe: true, layer: 'output_filter' }
  }
}
