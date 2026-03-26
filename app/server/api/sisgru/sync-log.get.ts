import { defineEventHandler, createError } from 'h3'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

// Requisitos: 12.3, 12.4, 12.5
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.sync_log')

  try {
    const result = await query(
      `SELECT * FROM sisgru_sync_log ORDER BY finalizado_em DESC LIMIT 50`,
      [],
    )
    return result.rows
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
