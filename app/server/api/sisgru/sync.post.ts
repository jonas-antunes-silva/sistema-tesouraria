import { defineEventHandler, createError, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../utils/rbac'
import { syncDia } from '../../services/sisgruSync'

const BodySchema = z.object({
  data: z.string().optional(),
})

function formatarDataApi(data: string): string {
  const [yyyy, mm, dd] = data.split('-')
  return `${dd}/${mm}/${yyyy}`
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.sync')

  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body ?? {})
  const rawData = parsed.success ? parsed.data.data : undefined

  const data = rawData ? formatarDataApi(rawData) : undefined

  try {
    await syncDia(data)
    return { ok: true, mensagem: 'Sincronização iniciada' }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao iniciar sincronização' })
  }
})
