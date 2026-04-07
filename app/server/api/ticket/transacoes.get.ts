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
              te.estornado,
              te.estornado_em,
              te.estorno_motivo,
              u.nome AS responsavel_nome,
              ue.nome AS estornado_por_nome,
              te.cpf AS codigo_contribuinte,
              te.nome AS nome_contribuinte
       FROM ticket_entregas te
       LEFT JOIN usuarios u ON u.id = te.responsavel_id
       LEFT JOIN usuarios ue ON ue.id = te.estornado_por
       WHERE DATE(te.criado_em) = CURRENT_DATE
       ORDER BY te.criado_em DESC`,
      [],
    )
    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      quantidade: Number(row.quantidade),
      valor_unitario: row.valor_unitario == null ? null : Number(row.valor_unitario),
      valor_consumido: row.valor_consumido == null ? null : Number(row.valor_consumido),
      saldo_depois: row.saldo_depois == null ? null : Number(row.saldo_depois),
    }))
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
