import { createHash } from 'crypto'
import { query } from './db'

/**
 * Calcula o hash SHA-256 do token em formato hexadecimal.
 * O banco armazena apenas o hash — nunca o token bruto.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Cria uma nova sessão no banco.
 * Armazena apenas o hash SHA-256 do token, nunca o token bruto.
 */
export async function createSession(
  userId: string,
  ip: string,
  token: string,
): Promise<void> {
  const tokenHash = hashToken(token)
  await query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em, ip_origem)
     VALUES ($1, $2, NOW() + INTERVAL '8 hours', $3)`,
    [userId, tokenHash, ip],
  )
}

/**
 * Valida uma sessão pelo token.
 * Retorna { userId } se a sessão estiver ativa, ou null se inválida/expirada.
 */
export async function validateSession(
  token: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token)
  const result = await query<{ usuario_id: string }>(
    `SELECT usuario_id FROM sessoes
     WHERE token_hash = $1 AND expira_em > NOW()`,
    [tokenHash],
  )
  if (result.rows.length === 0) {
    return null
  }
  return { userId: result.rows[0].usuario_id }
}

/**
 * Invalida (deleta) uma sessão pelo token.
 */
export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await query('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash])
}
