import { defineEventHandler, createError } from 'h3'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

interface UsuarioRow {
  id: string
  nome: string
  email: string
  ativo: boolean
  criado_em: string
  grupos: string[]
}

export default defineEventHandler(async (event) => {
  // Requer permissão admin.usuarios (Requisitos 4.1, 4.4)
  await requirePermission(event, 'admin.usuarios')

  try {
    // Query parametrizada — sem senha_hash (Requisito 5.2)
    const result = await query<UsuarioRow>(
      `SELECT
         u.id,
         u.nome,
         u.email,
         u.ativo,
         u.criado_em,
         COALESCE(
           array_agg(g.nome) FILTER (WHERE g.nome IS NOT NULL),
           '{}'
         ) AS grupos
       FROM usuarios u
       LEFT JOIN usuario_grupos ug ON ug.usuario_id = u.id
       LEFT JOIN grupos g ON g.id = ug.grupo_id
       GROUP BY u.id, u.nome, u.email, u.ativo, u.criado_em
       ORDER BY u.nome`,
      [],
    )

    return result.rows.map((u) => ({
      ...u,
      grupos: u.grupos ?? [],
    }))
  } catch (err) {
    // Nunca expõe detalhes internos ao cliente (Requisito 5.4)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
