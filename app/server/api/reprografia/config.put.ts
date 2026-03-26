import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { query } from '../../utils/db'
import { requirePermission } from '../../utils/rbac'

const schema = z.object({
  valor_por_copia: z
    .union([z.number(), z.string()])
    .transform((v) => {
      if (typeof v === 'number') return v
      const normalized = v.replace(',', '.')
      return Number(normalized)
    })
    .refine((n) => Number.isFinite(n) && n > 0, 'valor_por_copia deve ser um número positivo maior que zero'),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.reprografia')

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

  const valorPorCopia = parsed.data.valor_por_copia
  const valorStr = valorPorCopia.toFixed(4)

  try {
    const updated = await query<{
      valor: string
      atualizado_em: string
      atualizado_por: string | null
    }>(
      `UPDATE reprografia_config
       SET valor = $1,
           atualizado_em = NOW(),
           atualizado_por = $2
       WHERE chave = 'valor_por_copia'
       RETURNING valor, atualizado_em, atualizado_por`,
      [valorStr, userId],
    )

    if (updated.rows.length === 0) {
      throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar configuração' })
    }

    const row = updated.rows[0]

    const nomeAdmin = row.atualizado_por
      ? await query<{ nome: string }>(
          `SELECT nome FROM usuarios WHERE id = $1 LIMIT 1`,
          [row.atualizado_por],
        ).then((r) => r.rows[0]?.nome ?? null)
      : null

    setResponseStatus(event, 200)
    return {
      valor_por_copia: Number(row.valor),
      atualizado_em: row.atualizado_em,
      atualizado_por_nome: nomeAdmin,
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})

