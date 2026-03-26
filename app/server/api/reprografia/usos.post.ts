import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { pool } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'

const schema = z.object({
  cpf: z
    .string()
    .min(1, 'CPF é obrigatório')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((digits) => digits.length === 11, 'CPF inválido'),
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

    // Bloqueia a linha do crédito para garantir atomicidade do saldo
    const credito = await client.query<{
      cpf: string
      nome: string
      saldo: string
    }>(
      `SELECT cpf, nome, saldo
       FROM reprografia_creditos
       WHERE regexp_replace(cpf, '\\D', '', 'g') = $1
       LIMIT 1
       FOR UPDATE`,
      [cpfDigits],
    )

    const creditoRow = credito.rows[0]
    if (!creditoRow) {
      throw createError({
        statusCode: 422,
        statusMessage: 'CPF não possui créditos cadastrados',
      })
    }

    const saldoAnterior = Number(creditoRow.saldo)
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
        creditoRow.cpf,
        creditoRow.nome,
        numCopias,
        valorPorCopia.toFixed(4),
        valorTotalStr,
        saldoAnterior.toFixed(2),
        saldoPosterior.toFixed(2),
        userId,
      ],
    )

    // Debitar saldo
    await client.query(
      `UPDATE reprografia_creditos
       SET saldo = saldo - $1::numeric,
           atualizado_em = NOW()
       WHERE cpf = $2`,
      [valorTotalStr, creditoRow.cpf],
    )

    await client.query('COMMIT')

    const usoRow = usoResult.rows[0]
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

