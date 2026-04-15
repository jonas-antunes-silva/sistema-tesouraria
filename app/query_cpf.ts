import { query } from './app/server/utils/db'

async function checkCpf(cpf: string) {
  const cleanCpf = cpf.replace(/\D/g, '')
  console.log(`Checking CPF: ${cleanCpf}`)

  const pagamentos = await query(`
    SELECT id, valor_total, situacao, servico_id, data
    FROM sisgru_pagamentos
    WHERE regexp_replace(codigo_contribuinte, '\\D', '', 'g') = $1
      AND COALESCE(servico_id_retificado, servico_id) = 14671
  `, [cleanCpf])

  console.log('--- sisgru_pagamentos ---')
  console.table(pagamentos.rows)

  const lancamentos = await query(`
    SELECT id, tipo, valor, origem, origem_id, chave_idempotencia
    FROM financeiro_lancamentos
    WHERE modulo = 'ticket'
      AND regexp_replace(cpf, '\\D', '', 'g') = $1
  `, [cleanCpf])

  console.log('--- financeiro_lancamentos ---')
  console.table(lancamentos.rows)
}

checkCpf('136.554.489-37').catch(console.error)
