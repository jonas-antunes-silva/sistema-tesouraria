import { H3Event, createError } from 'h3'
import { query } from './db'

/**
 * Verifica se o usuário possui a permissão informada.
 * Usa query parametrizada — proteção contra SQL Injection (Requisito 5.2).
 */
export async function checkPermission(
  userId: string,
  permissao: string,
): Promise<boolean> {
  const result = await query<{ '?column?': number }>(
    `SELECT 1 FROM usuario_grupos ug
     INNER JOIN grupo_permissoes gp ON gp.grupo_id = ug.grupo_id
     INNER JOIN permissoes p ON p.id = gp.permissao_id
     WHERE ug.usuario_id = $1 AND p.nome = $2
     LIMIT 1`,
    [userId, permissao],
  )
  return result.rows.length > 0
}

/**
 * Lança 401 se não houver userId no contexto, ou 403 se o usuário
 * não possuir a permissão necessária. (Requisitos 3.2, 3.4, 3.5)
 */
export async function requirePermission(
  event: H3Event,
  permissao: string,
): Promise<void> {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const allowed = await checkPermission(userId, permissao)
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }
}
