import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

interface GrupoRow {
  id: string
  nome: string
  descricao: string | null
  permissoes: string[]
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.grupos')

  const result = await query<GrupoRow>(
    `SELECT g.id, g.nome, g.descricao,
            array_agg(p.nome) FILTER (WHERE p.nome IS NOT NULL) AS permissoes
     FROM grupos g
     LEFT JOIN grupo_permissoes gp ON gp.grupo_id = g.id
     LEFT JOIN permissoes p ON p.id = gp.permissao_id
     GROUP BY g.id, g.nome, g.descricao
     ORDER BY g.nome`,
    [],
  )

  return result.rows.map((g) => ({
    ...g,
    permissoes: g.permissoes ?? [],
  }))
})
