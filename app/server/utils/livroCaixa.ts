export type LivroCaixaModulo = 'reprografia' | 'ticket'
export type LivroCaixaTipo = 'credito' | 'debito'

interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>
}

interface RegistrarLancamentoParams {
  modulo: LivroCaixaModulo
  cpf: string
  nome: string
  tipo: LivroCaixaTipo
  valor: number
  origem: string
  origemId: string
  chaveIdempotencia: string
  metadata?: Record<string, unknown>
  criadoEm?: string
}

interface ResumoLivroCaixa {
  creditos: number
  debitos: number
  saldo: number
}

function normalizarCpfLivroCaixa(valor: string): string {
  return valor.replace(/\D/g, '')
}

function moduloPorServicoId(servicoId: number): LivroCaixaModulo | null {
  if (servicoId === 16279) return 'reprografia'
  if (servicoId === 14671) return 'ticket'
  return null
}

async function travarContaLivroCaixa(
  executor: SqlExecutor,
  modulo: LivroCaixaModulo,
  cpf: string,
): Promise<void> {
  await executor.query(
    `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
    [modulo, normalizarCpfLivroCaixa(cpf)],
  )
}

async function obterResumoLivroCaixa(
  executor: SqlExecutor,
  modulo: LivroCaixaModulo,
  cpf: string,
): Promise<ResumoLivroCaixa> {
  const result = await executor.query<{ creditos: string; debitos: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor END), 0)::text AS creditos,
       COALESCE(SUM(CASE WHEN tipo = 'debito' THEN valor END), 0)::text AS debitos
     FROM financeiro_lancamentos
     WHERE modulo = $1
       AND regexp_replace(cpf, '\\D', '', 'g') = $2`,
    [modulo, normalizarCpfLivroCaixa(cpf)],
  )

  const creditos = Number(result.rows[0]?.creditos ?? '0')
  const debitos = Number(result.rows[0]?.debitos ?? '0')
  const saldo = Number((creditos - debitos).toFixed(2))

  return {
    creditos,
    debitos,
    saldo: saldo > 0 ? saldo : 0,
  }
}

async function sincronizarSaldoReprografiaMaterializado(
  executor: SqlExecutor,
  cpf: string,
  nomeFallback: string,
): Promise<void> {
  const cpfDigits = normalizarCpfLivroCaixa(cpf)

  const resumo = await executor.query<{ saldo: string; nome: string | null }>(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0)::text AS saldo,
       MAX(NULLIF(btrim(nome), '')) AS nome
     FROM financeiro_lancamentos
     WHERE modulo = 'reprografia'
       AND regexp_replace(cpf, '\\D', '', 'g') = $1`,
    [cpfDigits],
  )

  const saldo = Number(resumo.rows[0]?.saldo ?? '0')
  const nome = resumo.rows[0]?.nome?.trim() || nomeFallback.trim() || 'Nao informado'

  await executor.query(
    `INSERT INTO reprografia_creditos (cpf, nome, saldo, atualizado_em)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (cpf) DO UPDATE
     SET nome = EXCLUDED.nome,
         saldo = EXCLUDED.saldo,
         atualizado_em = NOW()`,
    [cpfDigits, nome, saldo > 0 ? saldo.toFixed(2) : '0.00'],
  )
}

async function registrarLancamentoLivroCaixa(
  executor: SqlExecutor,
  params: RegistrarLancamentoParams,
): Promise<boolean> {
  const cpfDigits = normalizarCpfLivroCaixa(params.cpf)
  const nome = params.nome.trim() || 'Nao informado'

  const result = await executor.query<{ id: string }>(
    `INSERT INTO financeiro_lancamentos (
       modulo,
       cpf,
       nome,
       tipo,
       valor,
       origem,
       origem_id,
       chave_idempotencia,
       metadata,
       criado_em
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, COALESCE($10::timestamp, NOW())
     )
     ON CONFLICT (chave_idempotencia) DO NOTHING
     RETURNING id`,
    [
      params.modulo,
      cpfDigits,
      nome,
      params.tipo,
      params.valor.toFixed(2),
      params.origem,
      params.origemId,
      params.chaveIdempotencia,
      JSON.stringify(params.metadata ?? {}),
      params.criadoEm ?? null,
    ],
  )

  const inserido = (result.rowCount ?? 0) > 0
  if (!inserido) return false

  if (params.modulo === 'reprografia') {
    await sincronizarSaldoReprografiaMaterializado(executor, cpfDigits, nome)
  }

  return true
}

export {
  moduloPorServicoId,
  normalizarCpfLivroCaixa,
  obterResumoLivroCaixa,
  registrarLancamentoLivroCaixa,
  sincronizarSaldoReprografiaMaterializado,
  travarContaLivroCaixa,
}
