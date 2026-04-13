import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { pool } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'
import {
  obterResumoLivroCaixa,
  registrarLancamentoLivroCaixa,
  travarContaLivroCaixa,
} from '../../utils/livroCaixa'

const schema = z.object({
  cpf: z
    .string()
    .min(1, 'Documento é obrigatório')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11 || digits.length === 14, 'CPF/CNPJ inválido'),
  num_copias: z
    .number()
    .int('num_copias deve ser inteiro')
    .positive('num_copias deve ser positivo'),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reprografia.usos')

  const userId = event.context.userId as string

  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message ?? 'Dados inválidos',
      data: parsed.error.flatten().fieldErrors,
    })
  }

  const cpfDigits = parsed.data.cpf
  const numCopias = parsed.data.num_copias

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Snapshot do valor por cópia vigente
    const cfg = await client.query<{ valor: string }>(
      `SELECT valor
       FROM reprografia_config
       WHERE chave = 'valor_por_copia'
       LIMIT 1`,
    )

    const valorPorCopiaRaw = cfg.rows[0]?.valor
    if (!valorPorCopiaRaw) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Configuração de reprografia não encontrada',
      })
    }

    const valorPorCopia = Number(valorPorCopiaRaw)
    if (!Number.isFinite(valorPorCopia) || valorPorCopia <= 0) {
      throw createError({ statusCode: 500, statusMessage: 'Valor por cópia inválido' })
    }

    await travarContaLivroCaixa(client, 'reprografia', cpfDigits)

    const resumo = await obterResumoLivroCaixa(client, 'reprografia', cpfDigits)
    if (resumo.creditos <= 0) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Documento não possui créditos cadastrados',
      })
    }

    const nomeResult = await client.query<{ nome: string | null }>(
      `SELECT MAX(NULLIF(btrim(nome), '')) AS nome
       FROM financeiro_lancamentos
       WHERE modulo = 'reprografia'
         AND regexp_replace(cpf, '\\D', '', 'g') = $1`,
      [cpfDigits],
    )

    const nomeContribuinte = nomeResult.rows[0]?.nome?.trim() || 'Nao informado'
    const saldoAnterior = resumo.saldo
    const valorTotal = valorPorCopia * numCopias

    if (saldoAnterior < valorTotal) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Saldo insuficiente',
      })
    }

    const valorTotalStr = valorTotal.toFixed(2)
    const saldoPosterior = saldoAnterior - Number(valorTotalStr)

    // Registrar o uso
    const usoResult = await client.query<{
      id: number
      cpf: string
      nome: string
      num_copias: number
      valor_por_copia: string
      valor_total: string
      saldo_anterior: string
      saldo_posterior: string
      operador_id: string
      registrado_em: string
    }>(
      `INSERT INTO reprografia_usos (
         cpf, nome, num_copias,
         valor_por_copia, valor_total,
         saldo_anterior, saldo_posterior,
         operador_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        cpfDigits,
        nomeContribuinte,
        numCopias,
        valorPorCopia.toFixed(4),
        valorTotalStr,
        saldoAnterior.toFixed(2),
        saldoPosterior.toFixed(2),
        userId,
      ],
    )

    const usoRow = usoResult.rows[0]
    await registrarLancamentoLivroCaixa(client, {
      modulo: 'reprografia',
      cpf: cpfDigits,
      nome: nomeContribuinte,
      tipo: 'debito',
      valor: Number(valorTotalStr),
      origem: 'reprografia_uso',
      origemId: String(usoRow.id),
      chaveIdempotencia: `reprografia:uso:${usoRow.id}`,
      metadata: {
        num_copias: numCopias,
      },
    })

    await client.query('COMMIT')

    return {
      ...usoRow,
      valor_por_copia: Number(usoRow.valor_por_copia),
      valor_total: Number(usoRow.valor_total),
      saldo_anterior: Number(usoRow.saldo_anterior),
      saldo_posterior: Number(usoRow.saldo_posterior),
    }
  } catch (err: unknown) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }

    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  } finally {
    client.release()
  }
})

