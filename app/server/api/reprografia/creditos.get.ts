import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'
import { obterResumoLivroCaixa } from '../../utils/livroCaixa'

const schema = z.object({
  cpf: z
    .string()
    .min(1, 'CPF é obrigatório')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11, 'CPF inválido'),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reprografia.creditos')

  const params = getQuery(event)
  const parsed = schema.safeParse(params)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
    })
  }

  const cpfDigits = parsed.data.cpf

  try {
    const resumo = await obterResumoLivroCaixa({ query }, 'reprografia', cpfDigits)
    if (resumo.creditos <= 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'CPF não possui créditos cadastrados',
      })
    }

    const nomeResult = await query<{ nome: string | null }>(
      `SELECT MAX(NULLIF(btrim(nome), '')) AS nome
       FROM financeiro_lancamentos
       WHERE modulo = 'reprografia'
         AND regexp_replace(cpf, '\\D', '', 'g') = $1`,
      [cpfDigits],
    )

    const nome = nomeResult.rows[0]?.nome?.trim() || 'Nao informado'

    return {
      cpf: cpfDigits,
      nome,
      saldo: resumo.saldo,
      atualizado_em: new Date().toISOString(),
    }
  } catch (err: unknown) {
    // Não mascarar erros HTTP (ex.: 400/401/403/422) gerados pelo próprio handler.
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})

