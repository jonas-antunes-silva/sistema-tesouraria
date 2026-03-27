import { defineEventHandler, createError } from 'h3'
import { requirePermission } from '../../utils/rbac'
import { syncDia } from '../../services/sisgruSync'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.sync')

  try {
    await syncDia()
    return { ok: true, mensagem: 'Sincronização iniciada' }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao iniciar sincronização' })
  }
})
