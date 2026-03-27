import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../utils/rbac'
import { query } from '../../utils/db'

const BodySchema = z.object({
  precos: z.array(z.object({
    tipo: z.string(),
    valor: z.number().positive(),
  })),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')

  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  try {
    for (const preco of parsed.data.precos) {
      await query(
        'UPDATE ticket_precos SET valor = $1, atualizado_em = NOW() WHERE tipo = $2',
        [preco.valor, preco.tipo],
      )
    }
    return { ok: true }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
