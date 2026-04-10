import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { obterResumoLivroCaixa } from '../../utils/livroCaixa'

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
    const pagamentos = await query<{
      id: number
      codigo_contribuinte: string
      nome_contribuinte: string
      valor_total: string
      situacao: string
      data: string
    }>(
      `SELECT sp.id, sp.codigo_contribuinte, sp.nome_contribuinte,
              sp.valor_total, sp.situacao, sp.data
       FROM sisgru_pagamentos sp
       WHERE regexp_replace(sp.codigo_contribuinte, '\\D', '', 'g') = $1
         AND COALESCE(sp.servico_id_retificado, sp.servico_id) = 14671
         AND sp.situacao IN ('CO', 'CG')
       ORDER BY sp.data DESC`,
      [parsed.data.cpf],
    )

    const resumo = await obterResumoLivroCaixa({ query }, 'ticket', parsed.data.cpf)
    const totalCreditos = resumo.creditos
    const totalConsumido = resumo.debitos
    const saldoDisponivel = resumo.saldo

    return {
      cpf: parsed.data.cpf,
      nome: pagamentos.rows[0]?.nome_contribuinte ?? null,
      total_creditos: totalCreditos,
      total_consumido: totalConsumido,
      saldo_disponivel: saldoDisponivel,
      pagamentos: pagamentos.rows.map((p) => ({
        id: p.id,
        codigo_contribuinte: p.codigo_contribuinte,
        nome_contribuinte: p.nome_contribuinte,
        valor_total: Number(p.valor_total),
        situacao: p.situacao,
        data: p.data,
      })),
    }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
