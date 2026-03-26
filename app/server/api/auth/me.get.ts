import { defineEventHandler, getCookie, createError } from 'h3'
import { validateSession } from '../../utils/session'
import { query } from '../../utils/db'

interface UsuarioRow {
  id: string
  nome: string
  email: string
  grupos: string[]
}

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'session')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const session = await validateSession(token)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Sessão inválida ou expirada' })
  }

  // Buscar usuário com seus grupos via query parametrizada
  const result = await query<UsuarioRow>(
    `SELECT u.id, u.nome, u.email, array_agg(g.nome) AS grupos
     FROM usuarios u
     LEFT JOIN usuario_grupos ug ON ug.usuario_id = u.id
     LEFT JOIN grupos g ON g.id = ug.grupo_id
     WHERE u.id = $1 AND u.ativo = true
     GROUP BY u.id, u.nome, u.email`,
    [session.userId],
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Usuário não encontrado ou inativo' })
  }

  const usuario = result.rows[0]

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    // array_agg retorna [null] quando não há grupos — filtrar nulos
    grupos: (usuario.grupos ?? []).filter(Boolean) as string[],
  }
})
