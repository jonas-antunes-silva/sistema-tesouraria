import { defineEventHandler, getRouterParam, createError, readBody } from 'h3'
import { z } from 'zod'
import { query } from '../../../../utils/db'

// Requisitos: 15.3, 15.4, 15.5, 15.6
const idSchema = z
  .string()
  .regex(/^\d+$/, 'ID inválido')
  .transform(Number)
  .refine((n) => Number.isInteger(n) && n > 0, 'ID deve ser inteiro positivo')

export default defineEventHandler(async (event) => {
  // Middleware auth garante event.context.userId
  const userId = event.context.userId as string

  const rawId = getRouterParam(event, 'id')
  const parsedId = idSchema.safeParse(rawId)

  if (!parsedId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedId.error.errors[0]?.message ?? 'ID inválido',
    })
  }

  const id = parsedId.data

  try {
    // Buscar registro
    const found = await query<{
      id: number
      servico_id: number
      ticket_retirado: boolean
    }>(
      `SELECT id, servico_id, ticket_retirado FROM sisgru_pagamentos WHERE id = $1`,
      [id],
    )

    if (found.rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Pagamento não encontrado' })
    }

    const pagamento = found.rows[0]

    if (Number(pagamento.servico_id) !== 14671) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Operação disponível apenas para tickets de alimentação (serviço 14671)',
      })
    }

    if (pagamento.ticket_retirado) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Ticket já foi marcado como retirado',
      })
    }

    // Atualizar registro
    const updated = await query(
      `UPDATE sisgru_pagamentos
       SET ticket_retirado = true,
           ticket_retirado_em = NOW(),
           ticket_retirado_por = $1
       WHERE id = $2
       RETURNING *`,
      [userId, id],
    )

    return updated.rows[0]
  } catch (err: unknown) {
    // Re-lançar erros H3 (4xx) sem mascarar
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
