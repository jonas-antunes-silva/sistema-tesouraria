import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'

const schema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
})

export default defineEventHandler(async (event) => {
  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'CPF inválido',
    })
  }

  try {
    const result = await query(
      `SELECT sp.id, sp.codigo_contribuinte, sp.nome_contribuinte, 
              sp.valor_total, sp.situacao, sp.data, sp.ticket_retirado,
              sp.ticket_retirado_em, sp.ticket_retirado_por
       FROM sisgru_pagamentos sp
       WHERE sp.codigo_contribuinte = $1 
         AND sp.servico_id = 14671
         AND sp.ticket_retirado = false
       ORDER BY sp.data DESC`,
      [parsed.data.cpf],
    )
    return result.rows
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
