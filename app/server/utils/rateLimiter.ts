/**
 * Rate limiter em memória por IP.
 * Limite: 5 tentativas falhas em janela de 10 minutos (600_000 ms).
 * Requisitos: 2.1, 2.2, 2.3
 */

const WINDOW_MS = 600_000 // 10 minutos
const MAX_ATTEMPTS = 5

interface AttemptRecord {
  count: number
  firstAttempt: number
}

const attempts = new Map<string, AttemptRecord>()

/**
 * Verifica se o IP está bloqueado.
 * Limpa entradas expiradas antes de verificar.
 */
export function checkRateLimit(ip: string): { blocked: boolean } {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record) {
    return { blocked: false }
  }

  // Janela expirou — entrada obsoleta
  if (record.firstAttempt + WINDOW_MS < now) {
    attempts.delete(ip)
    return { blocked: false }
  }

  return { blocked: record.count >= MAX_ATTEMPTS }
}

/**
 * Registra uma tentativa falha para o IP.
 * - Se não existe entrada: cria com count=1 e firstAttempt=now
 * - Se existe e dentro da janela: incrementa count
 * - Se existe e janela expirou: reinicia com count=1
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record) {
    attempts.set(ip, { count: 1, firstAttempt: now })
    return
  }

  if (record.firstAttempt + WINDOW_MS < now) {
    // Janela expirou — reinicia
    attempts.set(ip, { count: 1, firstAttempt: now })
  } else {
    // Dentro da janela — incrementa
    record.count++
  }
}

/**
 * Remove a entrada do IP (login bem-sucedido).
 */
export function resetAttempts(ip: string): void {
  attempts.delete(ip)
}
