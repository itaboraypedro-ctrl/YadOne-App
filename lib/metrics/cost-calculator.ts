// lib/metrics/cost-calculator.ts — Tabela de preços por modelo e cálculo de custo em USD.
// Valores: 2026 (USD por 1M tokens).

const MODEL_PRICING_USD_PER_MTOK: Record<
  string,
  { input: number; output: number; per_minute?: number }
> = {
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'whisper-1': { input: 0, output: 0, per_minute: 0.006 },
}

/**
 * Calcula o custo em USD de uma chamada LLM dado o modelo e o consumo de tokens.
 * Modelo desconhecido → retorna 0 (não lança erro).
 */
export function calculateCost(
  model: string,
  input_tokens: number,
  output_tokens: number,
): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK[model]
  if (!pricing) {
    console.warn(`[cost-calculator] modelo desconhecido: "${model}" — custo calculado como 0`)
    return 0
  }
  return (
    (input_tokens / 1_000_000) * pricing.input +
    (output_tokens / 1_000_000) * pricing.output
  )
}

/**
 * Calcula o custo em USD de uma transcrição de áudio via Whisper.
 * @param minutes Duração do áudio em minutos.
 */
export function calculateAudioCost(minutes: number): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK['whisper-1']
  if (!pricing?.per_minute) return 0
  return minutes * pricing.per_minute
}
