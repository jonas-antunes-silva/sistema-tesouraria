import { defineEventHandler, createError, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../utils/rbac'
import { syncDia, syncDiaEspecifico } from '../../services/sisgruSync'

const schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido: YYYY-MM-DD').optional(),
})

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.sync')

  try {
    const body = await readBody(event).catch(() => ({}))
    const parsed = schema.safeParse(body ?? {})

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.errors[0]?.message ?? 'Parâmetro inválido',
      })
    }

    if (parsed.data.data) {
      await syncDiaEspecifico(parsed.data.data)
      return { ok: true, mensagem: `Sincronização concluída para ${parsed.data.data}` }
    }

    await syncDia()
    return { ok: true, mensagem: 'Sincronização iniciada' }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 500, statusMessage: 'Erro ao iniciar sincronização' })
  }
})
