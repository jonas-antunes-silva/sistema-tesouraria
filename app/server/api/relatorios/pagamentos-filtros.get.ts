import { defineEventHandler, createError } from 'h3'
import { checkPermission } from '../../utils/rbac'
import { query } from '../../utils/db'

async function hasAnyPermission(userId: string): Promise<boolean> {
  const permissions = ['tesoureiro', 'admin', 'tesoureiro.pagamentos']
  for (const perm of permissions) {
    if (await checkPermission(userId, perm)) return true
  }
  return false
}

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const allowed = await hasAnyPermission(userId)
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  try {
    const [servicosResult, tiposResult, situacoesResult] = await Promise.all([
      query(
        `SELECT DISTINCT COALESCE(servico_nome_retificado, servico_nome) AS nome
         FROM sisgru_pagamentos
         WHERE COALESCE(servico_nome_retificado, servico_nome) IS NOT NULL
           AND COALESCE(servico_nome_retificado, servico_nome) <> ''
         ORDER BY 1`,
        [],
      ),
      query(
        `SELECT DISTINCT tipo_pagamento_nome AS nome
         FROM sisgru_pagamentos
         WHERE tipo_pagamento_nome IS NOT NULL
           AND tipo_pagamento_nome <> ''
         ORDER BY 1`,
        [],
      ),
      query(
        `SELECT DISTINCT situacao AS codigo
         FROM sisgru_pagamentos
         WHERE situacao IS NOT NULL
           AND situacao <> ''
         ORDER BY 1`,
        [],
      ),
    ])

    return {
      servicos: servicosResult.rows.map((row) => String(row.nome)),
      tiposPagamento: tiposResult.rows.map((row) => String(row.nome)),
      situacoes: situacoesResult.rows.map((row) => String(row.codigo)),
    }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
