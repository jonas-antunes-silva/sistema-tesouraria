import { parseStringPromise } from 'xml2js'

export interface SisgruGru {
  id: string
  exercicio: number
  recolhimento: number
  recolhimentoContabilizado: number
  ugEmitente: string
  ugArrecadadora: string
  numeroRa: string
  situacao: string
  especieGr: number
  tipoRegistroGru: number
  tipoRecolhedor: number
  codigoRecolhedor: string
  numReferencia?: number
  dataVencimento?: string
  dataCompetencia?: string
  agenteArrecadador: string
  meioPagamento: string
  vlPrincipal: number
  vlDesconto: number
  vlOutraDeducao: number
  vlMulta: number
  vlJuros: number
  vlAcrescimo: number
  vlTotal: number
  observacao?: string
  dtEmissao: string
  dtTransferencia?: string
  dtContabilizacaoSiafi?: string
  origemArrecadacao: number
  especieIngresso: number
  dtCriacaoSisgru: string
  codigoPagamento: string
  tipoServico: number
  servico: number
  numeroTransacaoPsp?: string
  origemGru: number
}

export interface SisgruPagamento {
  id: number
  codigo: string
  ugCodigo: string
  ugExercicio: number
  ugNome: string
  tipoServicoCodigo: number
  tipoServicoNome: string
  servicoId: number
  servicoNome: string
  data: string
  dataPagamentoPsp?: string
  dataVencimento?: string
  competencia?: string
  numeroTransacaoPsp?: string
  recolhimentoCodigo: number
  recolhimentoExercicio: number
  recolhimentoDescricao: string
  codigoContribuinte: string
  nomeContribuinte: string
  numeroReferencia?: number
  tipoPagamentoCodigo: string
  tipoPagamentoNome: string
  provedorPagamentoId: number
  provedorPagamentoNome: string
  situacao: string
  valorTotal: number
  dataAlteracaoSituacaoPagTesouro: string
  ispb?: string
  formaUtilizacaoPagTesouro: number
}

// Helpers de conversão de tipos
function toNum(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function toOptNum(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const n = Number(val)
  return isNaN(n) ? undefined : n
}

function toStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

function toOptStr(val: unknown): string | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined
  return String(val).trim()
}

function toPgDate(val: unknown): string | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined
  const str = String(val).trim()
  const [datePart, timePart] = str.split(' ')
  const [dd, mm, yyyy] = datePart.split('/')
  if (!dd || !mm || !yyyy) return undefined
  if (timePart) {
    return `${yyyy}-${mm}-${dd} ${timePart}`
  }
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Faz parse do XML de GRUs retornado pelo SISGRU.
 * Lança erro se o XML estiver malformado.
 * Retorna [] se <grus> estiver vazio.
 */
async function parseGrus(xml: string): Promise<SisgruGru[]> {
  let parsed: Record<string, unknown>
  try {
    parsed = await parseStringPromise(xml, { explicitArray: false, trim: true })
  } catch (err) {
    throw new Error(`[sisgruParser] XML de GRUs malformado: ${(err as Error).message}`)
  }

  const root = parsed as { grus?: { gru?: unknown } }
  if (!root.grus || root.grus === '') {
    return []
  }

  const gruRaw = root.grus.gru
  if (!gruRaw) return []

  // xml2js retorna objeto único quando há apenas 1 elemento; normalizar para array
  const gruArray: Record<string, unknown>[] = Array.isArray(gruRaw)
    ? (gruRaw as Record<string, unknown>[])
    : [gruRaw as Record<string, unknown>]

  return gruArray.map((g) => ({
    id: toStr(g.id),
    exercicio: toNum(g.exercicio),
    recolhimento: toNum(g.recolhimento),
    recolhimentoContabilizado: toNum(g.recolhimentoContabilizado),
    ugEmitente: toStr(g.ugEmitente),
    ugArrecadadora: toStr(g.ugArrecadadora),
    numeroRa: toStr(g.numeroRa),
    situacao: toStr(g.situacao),
    especieGr: toNum(g.especieGR),
    tipoRegistroGru: toNum(g.tipoRegistroGRU),
    tipoRecolhedor: toNum(g.tipoRecolhedor),
    codigoRecolhedor: toStr(g.codigoRecolhedor),
    numReferencia: toOptNum(g.numReferencia),
    dataVencimento: toPgDate(g.dataVencimento),
    dataCompetencia: toOptStr(g.dataCompetencia),
    agenteArrecadador: toStr(g.agenteArrecadador),
    meioPagamento: toStr(g.meioPagamento),
    vlPrincipal: toNum(g.vlPrincipal),
    vlDesconto: toNum(g.vlDesconto),
    vlOutraDeducao: toNum(g.vlOutradeducao),
    vlMulta: toNum(g.vlMulta),
    vlJuros: toNum(g.vlJuros),
    vlAcrescimo: toNum(g.vlAcrescimo),
    vlTotal: toNum(g.vlTotal),
    observacao: toOptStr(g.observacao),
    dtEmissao: toPgDate(g.dtEmissao),
    dtTransferencia: toPgDate(g.dtTransferencia),
    dtContabilizacaoSiafi: toPgDate(g.dtContabilizacaoSiafi),
    origemArrecadacao: toNum(g.origemArrecadacao),
    especieIngresso: toNum(g.especieIngresso),
    dtCriacaoSisgru: toPgDate(g.dtCriacaoSISGRU),
    codigoPagamento: toStr(g.codigoPagamento),
    tipoServico: toNum(g.tipoServico),
    servico: toNum(g.servico),
    numeroTransacaoPsp: toOptStr(g.numeroTransacaoPSP),
    origemGru: toNum(g.origemGRU),
  }))
}

/**
 * Faz parse do XML de Pagamentos retornado pelo SISGRU.
 * Lança erro se o XML estiver malformado.
 * Retorna [] se <pagamentos> estiver vazio.
 */
async function parsePagamentos(xml: string): Promise<SisgruPagamento[]> {
  let parsed: Record<string, unknown>
  try {
    parsed = await parseStringPromise(xml, { explicitArray: false, trim: true })
  } catch (err) {
    throw new Error(`[sisgruParser] XML de Pagamentos malformado: ${(err as Error).message}`)
  }

  const root = parsed as { pagamentos?: { pagamento?: unknown } }
  if (!root.pagamentos) {
    throw new Error('[sisgruParser] XML de Pagamentos não contém elemento raiz <pagamentos>')
  }

  const pagRaw = root.pagamentos.pagamento
  if (!pagRaw) return []

  const pagArray: Record<string, unknown>[] = Array.isArray(pagRaw)
    ? (pagRaw as Record<string, unknown>[])
    : [pagRaw as Record<string, unknown>]

  return pagArray.map((p) => {
    const ug = (p.ug ?? {}) as Record<string, unknown>
    const tipoServico = (p.tipoServico ?? {}) as Record<string, unknown>
    const servico = (p.servico ?? {}) as Record<string, unknown>
    const recolhimento = (p.recolhimento ?? {}) as Record<string, unknown>
    const tipoPagamento = (p.tipoPagamento ?? {}) as Record<string, unknown>
    const provedorPagamento = (p.provedorPagamento ?? {}) as Record<string, unknown>

    return {
      id: toNum(p.id),
      codigo: toStr(p.codigo),
      ugCodigo: toStr(ug.codigo),
      ugExercicio: toNum(ug.exercicio),
      ugNome: toStr(ug.nome),
      tipoServicoCodigo: toNum(tipoServico.codigo),
      tipoServicoNome: toStr(tipoServico.nome),
      servicoId: toNum(servico.id),
      servicoNome: toStr(servico.nome),
      data: toPgDate(p.data),
      dataPagamentoPsp: toPgDate(p.dataPagamentoPSP),
      dataVencimento: toPgDate(p.dataVencimento),
      competencia: toOptStr(p.competencia),
      numeroTransacaoPsp: toOptStr(p.numeroTransacaoPSP),
      recolhimentoCodigo: toNum(recolhimento.codigo),
      recolhimentoExercicio: toNum(recolhimento.exercicio),
      recolhimentoDescricao: toStr(recolhimento.descricao),
      codigoContribuinte: toStr(p.codigoContribuinte),
      nomeContribuinte: toStr(p.nomeContribuinte),
      numeroReferencia: toOptNum(p.numeroReferencia),
      tipoPagamentoCodigo: toStr(tipoPagamento.codigo),
      tipoPagamentoNome: toStr(tipoPagamento.nome),
      provedorPagamentoId: toNum(provedorPagamento.id),
      provedorPagamentoNome: toStr(provedorPagamento.nome),
      situacao: toStr(p.situacao),
      valorTotal: toNum(p.valorTotal),
      dataAlteracaoSituacaoPagTesouro: toPgDate(p.dataAlteracaoSituacaoPagTesouro),
      ispb: toOptStr(p.ispb),
      formaUtilizacaoPagTesouro: toNum(p.formaUtilizacaoPagTesouro),
    }
  })
}

export { parseGrus, parsePagamentos }
