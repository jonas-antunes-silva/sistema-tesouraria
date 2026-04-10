import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../../utils/db'

const schema = z.object({
  codigo: z.string().trim().min(1, 'Código de pagamento obrigatório').max(60, 'Código inválido'),
})

export default defineEventHandler(async (event) => {
  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
    })
  }

  try {
    const result = await query(
      `SELECT sp.id,
              sp.codigo,
              sp.codigo_contribuinte,
              sp.nome_contribuinte,
              sp.numero_referencia,
              COALESCE(sp.servico_id_retificado, sp.servico_id) AS servico_id,
              COALESCE(sp.servico_nome_retificado, sp.servico_nome) AS servico_nome,
              sp.situacao,
              sp.valor_total,
              sp.tipo_pagamento_nome,
              sp.data,
              sp.data_pagamento_psp,
              sp.data_alteracao_situacao_pag_tesouro,
              sp.dt_criacao,
              sp.sincronizado_em
       FROM sisgru_pagamentos sp
       WHERE sp.codigo = $1
       ORDER BY sp.sincronizado_em DESC
       LIMIT 1`,
      [parsed.data.codigo],
    )

    if (result.rows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Pagamento não encontrado' })
    }

    const row = result.rows[0] as Record<string, unknown>

    return {
      ...row,
      id: Number(row.id),
      numero_referencia: row.numero_referencia == null ? null : Number(row.numero_referencia),
      servico_id: Number(row.servico_id),
      valor_total: Number(row.valor_total),
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
