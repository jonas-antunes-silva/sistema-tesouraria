import { defineEventHandler, createError, getQuery } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'

const configSchema = z.object({
  // Placeholder para facilitar validação extensível no futuro
  dummy: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // Permissão de reprografia (apenas para evitar expor informações sem autenticação)
  await requirePermission(event, 'reprografia.creditos')

  // Garante compatibilidade caso a rota receba query inesperada
  const _params = configSchema.safeParse(getQuery(event))
  void _params

  try {
    const result = await query<{
      valor: string
      atualizado_em: string
      atualizado_por_nome: string | null
    }>(
      `SELECT
         c.valor,
         c.atualizado_em,
         u.nome AS atualizado_por_nome
       FROM reprografia_config c
       LEFT JOIN usuarios u ON u.id = c.atualizado_por
       WHERE c.chave = 'valor_por_copia'
       LIMIT 1`,
      [],
    )

    const row = result.rows[0]
    if (!row) {
      throw createError({ statusCode: 500, statusMessage: 'Configuração de reprografia ausente' })
    }

    return {
      valor_por_copia: Number(row.valor),
      atualizado_em: row.atualizado_em,
      atualizado_por_nome: row.atualizado_por_nome,
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})

