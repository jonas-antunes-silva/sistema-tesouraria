import { defineEventHandler, createError } from 'h3'
import { query } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const result = await query(
      `SELECT te.id,
              te.tipo,
              te.quantidade,
              te.criado_em,
              te.valor_unitario,
              te.valor_consumido,
              te.saldo_depois,
              u.nome AS responsavel_nome,
              te.cpf AS codigo_contribuinte,
              te.nome AS nome_contribuinte
       FROM ticket_entregas te
       LEFT JOIN usuarios u ON u.id = te.responsavel_id
       WHERE DATE(te.criado_em) = CURRENT_DATE
       ORDER BY te.criado_em DESC`,
      [],
    )
    return result.rows
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
