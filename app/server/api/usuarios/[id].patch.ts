import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

// Schema de validação para atribuir grupos
const atribuirGruposSchema = z.object({
  grupo_ids: z.array(z.string().uuid('ID de grupo inválido')),
})

interface UsuarioCriadoRow {
  id: string
  nome: string
  email: string
  ativo: boolean
  grupos: string[]
}

export default defineEventHandler(async (event) => {
  // Requer permissão admin.usuarios
  await requirePermission(event, 'admin.usuarios')

  const usuarioId = getRouterParam(event, 'id')
  if (!usuarioId) {
    throw createError({ statusCode: 400, statusMessage: 'ID do usuário não fornecido' })
  }

  const body = await readBody(event)
  const parsed = atribuirGruposSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten().fieldErrors,
    })
  }

  const { grupo_ids } = parsed.data

  try {
    // Validação: confirma que usuário existe
    const usuarioResult = await query<{ id: string }>(
      'SELECT id FROM usuarios WHERE id = $1',
      [usuarioId],
    )

    if (usuarioResult.rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado' })
    }

    // Validação: confirma que todos os grupo_ids existem
    if (grupo_ids.length > 0) {
      const gruposResult = await query<{ id: string }>(
        `SELECT id FROM grupos WHERE id = ANY($1::uuid[])`,
        [grupo_ids],
      )

      if (gruposResult.rows.length !== grupo_ids.length) {
        throw createError({ statusCode: 400, statusMessage: 'Um ou mais grupos não existem' })
      }
    }

    // Transação: remove grupos antigos e insere novos
    // 1. Remove todos os grupos do usuário
    await query(`DELETE FROM usuario_grupos WHERE usuario_id = $1`, [usuarioId])

    // 2. Insere os novos grupos
    if (grupo_ids.length > 0) {
      // Monta VALUES dinâmico: ($1, $2), ($1, $3), ...
      const values = grupo_ids.map((_: string, i: number) => `($1, $${i + 2})`).join(',')
      await query(
        `INSERT INTO usuario_grupos (usuario_id, grupo_id) VALUES ${values}`,
        [usuarioId, ...grupo_ids],
      )
    }

    // Retorna usuário com grupos atualizados
    const updatedResult = await query<{
      id: string
      nome: string
      email: string
      ativo: boolean
      grupos: string[]
    }>(
      `SELECT
         u.id,
         u.nome,
         u.email,
         u.ativo,
         COALESCE(
           array_agg(g.nome) FILTER (WHERE g.nome IS NOT NULL),
           '{}'
         ) AS grupos
       FROM usuarios u
       LEFT JOIN usuario_grupos ug ON ug.usuario_id = u.id
       LEFT JOIN grupos g ON g.id = ug.grupo_id
       WHERE u.id = $1
       GROUP BY u.id, u.nome, u.email, u.ativo`,
      [usuarioId],
    )

    return updatedResult.rows[0]
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error('[usuarios] erro ao atribuir grupos:', (err as Error).message)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
