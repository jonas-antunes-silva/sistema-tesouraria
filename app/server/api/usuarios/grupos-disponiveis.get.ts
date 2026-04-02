import { defineEventHandler, createError } from 'h3'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

interface GrupoRow {
  id: string
  nome: string
  descricao: string | null
}

export default defineEventHandler(async (event) => {
  // Requer permissão admin.usuarios (menos restritivo que admin.grupos)
  await requirePermission(event, 'admin.usuarios')

  try {
    const result = await query<GrupoRow>(
      `SELECT id, nome, descricao FROM grupos ORDER BY nome`,
      [],
    )

    return result.rows
  } catch (err: unknown) {
    console.error('[usuarios] erro ao listar grupos:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
