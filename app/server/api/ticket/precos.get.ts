import { defineEventHandler, createError } from 'h3'
import { query } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const result = await query(
      'SELECT id, tipo, valor FROM ticket_precos ORDER BY id',
      [],
    )
    return result.rows
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
