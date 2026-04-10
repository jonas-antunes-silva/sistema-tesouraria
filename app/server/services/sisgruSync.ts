import { gerarJwtSisgru } from '../utils/sisgruJwt'
import { parseGrus, parsePagamentos } from '../utils/sisgruParser'
import { query } from '../utils/db'
import { createHash } from 'node:crypto'
import {
  moduloPorServicoId,
  normalizarCpfLivroCaixa,
  registrarLancamentoLivroCaixa,
} from '../utils/livroCaixa'

const SISGRU_URL_BASE = process.env.SISGRU_URL_BASE ?? ''
const SISGRU_UG = process.env.SISGRU_UG ?? ''

const SITUACAO_PAGAMENTO_GRU_CONCLUIDO = 'CG'

function normalizarCpf(valor: string): string | null {
  const digits = valor.replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

function gerarIdPagamentoBoleto(gruId: string): string {
  const hashHex = createHash('sha256').update(`gru-boleto:${gruId}`).digest('hex').slice(0, 16)
  const numero = BigInt(`0x${hashHex}`)
  const faixa = 9_000_000_000_000_000_000n
  const base = 1_000_000_000_000_000_000n
  return ((numero % faixa) + base).toString()
}

async function inserirPagamentoBoletoDaGru(params: {
  gruId: string
  codigoRecolhedor: string
  servicoId: number
  valorTotal: number
  dtEmissao: string
  numReferencia: number | null
}): Promise<void> {
  const cpf = normalizarCpf(params.codigoRecolhedor)
  if (!cpf) {
    return
  }

  const nomeResult = await query<{ nome_contribuinte: string }>(
    `SELECT nome_contribuinte
     FROM sisgru_pagamentos
     WHERE regexp_replace(codigo_contribuinte, '\\D', '', 'g') = $1
       AND nome_contribuinte IS NOT NULL
       AND btrim(nome_contribuinte) <> ''
     ORDER BY data DESC NULLS LAST, sincronizado_em DESC NULLS LAST, id DESC
     LIMIT 1`,
    [cpf],
  )

  const nomeContribuinte = nomeResult.rows[0]?.nome_contribuinte?.trim() ?? null
  if (!nomeContribuinte) {
    console.warn(
      `[sisgruSync] Pagamento boleto da GRU ${params.gruId} não inserido: CPF ${cpf} sem nome em pagamentos anteriores`,
    )
    return
  }

  const servicoGruValido = Number.isFinite(params.servicoId) && params.servicoId > 0 ? params.servicoId : null

  const servicoBoletoPareadoResult = await query<{ servico_id: string; servico_nome: string }>(
    `SELECT COALESCE(servico_id_retificado, servico_id)::text AS servico_id,
            COALESCE(servico_nome_retificado, servico_nome) AS servico_nome
     FROM sisgru_pagamentos
     WHERE regexp_replace(codigo_contribuinte, '\\D', '', 'g') = $1
       AND tipo_pagamento_nome ILIKE 'boleto'
       AND valor_total = $2::numeric
       AND COALESCE(servico_id_retificado, servico_id) IS NOT NULL
     ORDER BY ABS(EXTRACT(EPOCH FROM (COALESCE(data, NOW()) - $3::timestamp))) ASC,
              data DESC NULLS LAST,
              id DESC
     LIMIT 1`,
    [cpf, params.valorTotal.toFixed(2), params.dtEmissao],
  )

  const servicoPareado = servicoBoletoPareadoResult.rows[0]
  const servicoIdResolvido = Number(servicoPareado?.servico_id ?? servicoGruValido)

  if (!Number.isFinite(servicoIdResolvido) || servicoIdResolvido <= 0) {
    console.warn(
      `[sisgruSync] Pagamento boleto da GRU ${params.gruId} não inserido: serviço não identificado para CPF ${cpf}`,
    )
    return
  }

  const servicoNomeResult = await query<{ servico_nome: string }>(
    `SELECT servico_nome
     FROM sisgru_pagamentos
     WHERE COALESCE(servico_id_retificado, servico_id) = $1
       AND servico_nome IS NOT NULL
       AND btrim(servico_nome) <> ''
     ORDER BY sincronizado_em DESC NULLS LAST, id DESC
     LIMIT 1`,
    [servicoIdResolvido],
  )

  const servicoNome =
    servicoPareado?.servico_nome?.trim() ||
    servicoNomeResult.rows[0]?.servico_nome?.trim() ||
    `Serviço ${servicoIdResolvido}`
  const pagamentoId = gerarIdPagamentoBoleto(params.gruId)

  const result = await query(
    `INSERT INTO sisgru_pagamentos (
      id,
      codigo,
      servico_id,
      servico_nome,
      data,
      codigo_contribuinte,
      nome_contribuinte,
      numero_referencia,
      tipo_pagamento_codigo,
      tipo_pagamento_nome,
      situacao,
      valor_total,
      data_alteracao_situacao_pag_tesouro,
      dt_criacao,
      sincronizado_em
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      servico_id = EXCLUDED.servico_id,
      servico_nome = EXCLUDED.servico_nome,
      data = EXCLUDED.data,
      codigo_contribuinte = EXCLUDED.codigo_contribuinte,
      nome_contribuinte = EXCLUDED.nome_contribuinte,
      numero_referencia = EXCLUDED.numero_referencia,
      tipo_pagamento_codigo = EXCLUDED.tipo_pagamento_codigo,
      tipo_pagamento_nome = EXCLUDED.tipo_pagamento_nome,
      situacao = EXCLUDED.situacao,
      valor_total = EXCLUDED.valor_total,
      data_alteracao_situacao_pag_tesouro = NOW(),
      sincronizado_em = NOW()
    RETURNING (xmax = 0) AS is_new`,
    [
      pagamentoId,
      `GRU-${params.gruId}`,
      servicoIdResolvido,
      servicoNome,
      params.dtEmissao,
      cpf,
      nomeContribuinte,
      params.numReferencia,
      'BL',
      'Boleto',
      SITUACAO_PAGAMENTO_GRU_CONCLUIDO,
      params.valorTotal,
    ],
  )

  const rows = result.rows as { is_new: boolean }[]
  const foiInserido = rows.length > 0 && rows[0].is_new
  if (foiInserido) {
    const modulo = moduloPorServicoId(servicoIdResolvido)
    if (modulo) {
      await registrarLancamentoLivroCaixa(
        { query },
        {
          modulo,
          cpf: normalizarCpfLivroCaixa(cpf),
          nome: nomeContribuinte,
          tipo: 'credito',
          valor: params.valorTotal,
          origem: 'sisgru_pagamento',
          origemId: pagamentoId,
          chaveIdempotencia: `${modulo}:pagamento:${pagamentoId}`,
          metadata: {
            situacao: SITUACAO_PAGAMENTO_GRU_CONCLUIDO,
            servico_id: servicoIdResolvido,
            origem: 'gru_boleto',
          },
          criadoEm: params.dtEmissao,
        },
      )
    }
  }
}

/**
 * Formata uma data JS para DD/MM/YYYY.
 */
function formatarData(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0')
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  const yyyy = data.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Converte YYYY-MM-DD para DD/MM/YYYY.
 */
function isoParaDataBr(dataIso: string): string {
  const [yyyy, mm, dd] = dataIso.split('-')
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Gera um intervalo de datas (DD/MM/YYYY-DD/MM/YYYY) dos últimos N dias até hoje.
 */
function gerarIntervaloDias(dias: number): string {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - dias + 1)
  return `${formatarData(inicio)}-${formatarData(hoje)}`
}

/**
 * Gera intervalo do dia anterior (ontem).
 */
function gerarIntervaloOntem(): string {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  const data = formatarData(ontem)
  return `${data}-${data}`
}

/**
 * Registra uma entrada no sisgru_sync_log.
 */
async function registrarLog(params: {
  tipo: string
  qtdNovos: number | null
  qtdTotal: number | null
  status: 'sucesso' | 'erro'
  mensagemErro?: string
}): Promise<void> {
  try {
    await query(
      `INSERT INTO sisgru_sync_log (tipo, finalizado_em, qtd_novos, qtd_total, status, mensagem_erro)
       VALUES ($1, NOW(), $2, $3, $4, $5)`,
      [params.tipo, params.qtdNovos, params.qtdTotal, params.status, params.mensagemErro ?? null],
    )
  } catch (err) {
    console.error('[sisgruSync] Falha ao registrar sync_log:', (err as Error).message)
  }
}

/**
 * Sincroniza GRUs do SISGRU para o banco de dados.
 * @param data - Data no formato DD/MM/YYYY
 */
async function syncGrus(data: string): Promise<{ novos: number; total: number }> {
  const jwt = gerarJwtSisgru()
  const intervalo = `${data}-${data}`
  const filtros = `ugArrecadadora=${SISGRU_UG}&dtEmissao=${intervalo}`
  const url = `${SISGRU_URL_BASE}/grus?q=${encodeURIComponent(filtros)}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/xml',
    },
  })

  if (!response.ok) {
    throw new Error(`[sisgruSync] HTTP ${response.status} ao consultar /grus`)
  }

  const xml = await response.text()
  const grus = await parseGrus(xml)

  let novos = 0
  for (const gru of grus) {
    const result = await query(
      `INSERT INTO sisgru_grus (
        id, exercicio, recolhimento, recolhimento_contabilizado,
        ug_emitente, ug_arrecadadora, numero_ra, situacao,
        especie_gr, tipo_registro_gru, tipo_recolhedor, codigo_recolhedor,
        num_referencia, data_vencimento, data_competencia,
        agente_arrecadador, meio_pagamento,
        vl_principal, vl_desconto, vl_outra_deducao, vl_multa, vl_juros, vl_acrescimo, vl_total,
        observacao, dt_emissao, dt_transferencia, dt_contabilizacao_siafi,
        origem_arrecadacao, especie_ingresso, dt_criacao_sisgru,
        codigo_pagamento, tipo_servico, servico, numero_transacao_psp, origem_gru,
        dt_criacao, sincronizado_em
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17,
        $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28,
        $29, $30, $31,
        $32, $33, $34, $35, $36,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        exercicio = EXCLUDED.exercicio,
        recolhimento = EXCLUDED.recolhimento,
        recolhimento_contabilizado = EXCLUDED.recolhimento_contabilizado,
        ug_emitente = EXCLUDED.ug_emitente,
        ug_arrecadadora = EXCLUDED.ug_arrecadadora,
        numero_ra = EXCLUDED.numero_ra,
        situacao = EXCLUDED.situacao,
        especie_gr = EXCLUDED.especie_gr,
        tipo_registro_gru = EXCLUDED.tipo_registro_gru,
        tipo_recolhedor = EXCLUDED.tipo_recolhedor,
        codigo_recolhedor = EXCLUDED.codigo_recolhedor,
        num_referencia = EXCLUDED.num_referencia,
        data_vencimento = EXCLUDED.data_vencimento,
        data_competencia = EXCLUDED.data_competencia,
        agente_arrecadador = EXCLUDED.agente_arrecadador,
        meio_pagamento = EXCLUDED.meio_pagamento,
        vl_principal = EXCLUDED.vl_principal,
        vl_desconto = EXCLUDED.vl_desconto,
        vl_outra_deducao = EXCLUDED.vl_outra_deducao,
        vl_multa = EXCLUDED.vl_multa,
        vl_juros = EXCLUDED.vl_juros,
        vl_acrescimo = EXCLUDED.vl_acrescimo,
        vl_total = EXCLUDED.vl_total,
        observacao = EXCLUDED.observacao,
        dt_emissao = EXCLUDED.dt_emissao,
        dt_transferencia = EXCLUDED.dt_transferencia,
        dt_contabilizacao_siafi = EXCLUDED.dt_contabilizacao_siafi,
        origem_arrecadacao = EXCLUDED.origem_arrecadacao,
        especie_ingresso = EXCLUDED.especie_ingresso,
        dt_criacao_sisgru = EXCLUDED.dt_criacao_sisgru,
        codigo_pagamento = EXCLUDED.codigo_pagamento,
        tipo_servico = EXCLUDED.tipo_servico,
        servico = EXCLUDED.servico,
        numero_transacao_psp = EXCLUDED.numero_transacao_psp,
        origem_gru = EXCLUDED.origem_gru,
        sincronizado_em = NOW()
      RETURNING (xmax = 0) AS is_new`,
      [
        gru.id,
        gru.exercicio,
        gru.recolhimento,
        gru.recolhimentoContabilizado,
        gru.ugEmitente,
        gru.ugArrecadadora,
        gru.numeroRa,
        gru.situacao,
        gru.especieGr,
        gru.tipoRegistroGru,
        gru.tipoRecolhedor,
        gru.codigoRecolhedor,
        gru.numReferencia ?? null,
        gru.dataVencimento ?? null,
        gru.dataCompetencia ?? null,
        gru.agenteArrecadador,
        gru.meioPagamento,
        gru.vlPrincipal,
        gru.vlDesconto,
        gru.vlOutraDeducao,
        gru.vlMulta,
        gru.vlJuros,
        gru.vlAcrescimo,
        gru.vlTotal,
        gru.observacao ?? null,
        gru.dtEmissao,
        gru.dtTransferencia ?? null,
        gru.dtContabilizacaoSiafi ?? null,
        gru.origemArrecadacao,
        gru.especieIngresso,
        gru.dtCriacaoSisgru,
        gru.codigoPagamento,
        gru.tipoServico,
        gru.servico,
        gru.numeroTransacaoPsp ?? null,
        gru.origemGru,
      ],
    )
    const rows = result.rows as { is_new: boolean }[]
    if (rows.length > 0 && rows[0].is_new) novos++

    const origemGru = String(gru.origemGru ?? '')
    const situacaoGru = String(gru.situacao ?? '')
    const servicoId = Number(gru.servico)
    const valorTotal = Number(gru.vlTotal)

    if (
      origemGru === '1' &&
      situacaoGru === '02' &&
      Number.isFinite(valorTotal) &&
      valorTotal > 0 &&
      Boolean(gru.dtEmissao)
    ) {
      await inserirPagamentoBoletoDaGru({
        gruId: String(gru.id),
        codigoRecolhedor: String(gru.codigoRecolhedor ?? ''),
        servicoId,
        valorTotal,
        dtEmissao: String(gru.dtEmissao),
        numReferencia: gru.numReferencia != null ? Number(gru.numReferencia) : null,
      })
    }
  }

  return { novos, total: grus.length }
}

/**
 * Sincroniza GRUs dos últimos 5 dias, um dia por requisição.
 */
async function syncGrusDias(): Promise<{ novos: number; total: number }> {
  let totalNovos = 0
  let totalGeral = 0

  for (let i = 4; i >= 0; i--) {
    const data = new Date()
    data.setDate(data.getDate() - i)
    const dataFormatada = formatarData(data)

    try {
      const resultado = await syncGrus(dataFormatada)
      totalNovos += resultado.novos
      totalGeral += resultado.total
      console.log(`[sisgruSync] GRUs dia ${dataFormatada}: ${resultado.novos} novos / ${resultado.total} total`)
    } catch (err) {
      console.error(`[sisgruSync] Erro ao sincronizar GRUs do dia ${dataFormatada}: ${(err as Error).message}`)
    }
  }

  return { novos: totalNovos, total: totalGeral }
}

/**
 * Sincroniza GRUs dos últimos 5 dias (D-4 a D0), um dia por requisição.
 */
async function syncGrusUltimos5Dias(): Promise<void> {
  try {
    console.log('[sisgruSync] Iniciando sync de GRUs dos últimos 5 dias')
    const resultado = await syncGrusDias()
    console.log(
      `[sisgruSync] GRUs dos últimos 5 dias sincronizadas: ${resultado.novos} novos / ${resultado.total} total`,
    )
    await registrarLog({
      tipo: 'grus_ultimos_5d',
      qtdNovos: resultado.novos,
      qtdTotal: resultado.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro ao sincronizar GRUs dos últimos 5 dias: ${msg}`)
    await registrarLog({
      tipo: 'grus_ultimos_5d',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }
}

/**
 * Sincroniza Pagamentos do SISGRU para o banco de dados.
 * @param data - Data no formato DD/MM/YYYY
 * Para pagamentos com servico_id = 16279, acumula créditos em reprografia_creditos.
 */
async function syncPagamentos(data: string): Promise<{ novos: number; total: number }> {
  const jwt = gerarJwtSisgru()
  const intervalo = `${data}-${data}`
  const filtros = `ug=${SISGRU_UG}&data=${intervalo}`
  const url = `${SISGRU_URL_BASE}/pagamentos?q=${encodeURIComponent(filtros)}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/xml',
    },
  })

  if (!response.ok) {
    throw new Error(`[sisgruSync] HTTP ${response.status} ao consultar /pagamentos`)
  }

  const xml = await response.text()
  const pagamentos = await parsePagamentos(xml)

  let novos = 0
  for (const pag of pagamentos) {
    const result = await query(
      `INSERT INTO sisgru_pagamentos (
        id, codigo,
        ug_codigo, ug_exercicio, ug_nome,
        tipo_servico_codigo, tipo_servico_nome,
        servico_id, servico_nome,
        data, data_pagamento_psp, data_vencimento, competencia, numero_transacao_psp,
        recolhimento_codigo, recolhimento_exercicio, recolhimento_descricao,
        codigo_contribuinte, nome_contribuinte, numero_referencia,
        tipo_pagamento_codigo, tipo_pagamento_nome,
        provedor_pagamento_id, provedor_pagamento_nome,
        situacao, valor_total,
        data_alteracao_situacao_pag_tesouro,
        ispb, forma_utilizacao_pag_tesouro,
        dt_criacao, sincronizado_em
      ) VALUES (
        $1, $2,
        $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20,
        $21, $22,
        $23, $24,
        $25, $26,
        $27,
        $28, $29,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        codigo = EXCLUDED.codigo,
        ug_codigo = EXCLUDED.ug_codigo,
        ug_exercicio = EXCLUDED.ug_exercicio,
        ug_nome = EXCLUDED.ug_nome,
        tipo_servico_codigo = EXCLUDED.tipo_servico_codigo,
        tipo_servico_nome = EXCLUDED.tipo_servico_nome,
        servico_id = EXCLUDED.servico_id,
        servico_nome = EXCLUDED.servico_nome,
        data = EXCLUDED.data,
        data_pagamento_psp = EXCLUDED.data_pagamento_psp,
        data_vencimento = EXCLUDED.data_vencimento,
        competencia = EXCLUDED.competencia,
        numero_transacao_psp = EXCLUDED.numero_transacao_psp,
        recolhimento_codigo = EXCLUDED.recolhimento_codigo,
        recolhimento_exercicio = EXCLUDED.recolhimento_exercicio,
        recolhimento_descricao = EXCLUDED.recolhimento_descricao,
        codigo_contribuinte = EXCLUDED.codigo_contribuinte,
        nome_contribuinte = EXCLUDED.nome_contribuinte,
        numero_referencia = EXCLUDED.numero_referencia,
        tipo_pagamento_codigo = EXCLUDED.tipo_pagamento_codigo,
        tipo_pagamento_nome = EXCLUDED.tipo_pagamento_nome,
        provedor_pagamento_id = EXCLUDED.provedor_pagamento_id,
        provedor_pagamento_nome = EXCLUDED.provedor_pagamento_nome,
        situacao = EXCLUDED.situacao,
        valor_total = EXCLUDED.valor_total,
        data_alteracao_situacao_pag_tesouro = EXCLUDED.data_alteracao_situacao_pag_tesouro,
        ispb = EXCLUDED.ispb,
        forma_utilizacao_pag_tesouro = EXCLUDED.forma_utilizacao_pag_tesouro,
        sincronizado_em = NOW()
      RETURNING (xmax = 0) AS is_new`,
      [
        pag.id,
        pag.codigo,
        pag.ugCodigo,
        pag.ugExercicio,
        pag.ugNome,
        pag.tipoServicoCodigo,
        pag.tipoServicoNome,
        pag.servicoId,
        pag.servicoNome,
        pag.data,
        pag.dataPagamentoPsp ?? null,
        pag.dataVencimento ?? null,
        pag.competencia ?? null,
        pag.numeroTransacaoPsp ?? null,
        pag.recolhimentoCodigo,
        pag.recolhimentoExercicio,
        pag.recolhimentoDescricao,
        pag.codigoContribuinte,
        pag.nomeContribuinte,
        pag.numeroReferencia ?? null,
        pag.tipoPagamentoCodigo,
        pag.tipoPagamentoNome,
        pag.provedorPagamentoId,
        pag.provedorPagamentoNome,
        pag.situacao,
        pag.valorTotal,
        pag.dataAlteracaoSituacaoPagTesouro,
        pag.ispb ?? null,
        pag.formaUtilizacaoPagTesouro,
      ],
    )

    const rows = result.rows as { is_new: boolean }[]
    const foiInserido = rows.length > 0 && rows[0].is_new
    if (foiInserido) {
      novos++
    }

    const modulo = moduloPorServicoId(pag.servicoId)
    const situacaoConcluida = pag.situacao === 'CO' || pag.situacao === 'CG'
    if (modulo && situacaoConcluida && pag.valorTotal > 0) {
      await registrarLancamentoLivroCaixa(
        { query },
        {
          modulo,
          cpf: normalizarCpfLivroCaixa(pag.codigoContribuinte),
          nome: pag.nomeContribuinte,
          tipo: 'credito',
          valor: pag.valorTotal,
          origem: 'sisgru_pagamento',
          origemId: String(pag.id),
          chaveIdempotencia: `${modulo}:pagamento:${pag.id}`,
          metadata: {
            situacao: pag.situacao,
            servico_id: pag.servicoId,
          },
          criadoEm: pag.data,
        },
      )
    }
  }

  return { novos, total: pagamentos.length }
}

/**
 * Sincroniza pagamentos para uma lista de dias (offset em relação a hoje), um dia por requisição.
 */
async function syncPagamentosPorDias(offsetDias: number[]): Promise<{ novos: number; total: number }> {
  let totalNovos = 0
  let totalGeral = 0

  for (const offset of offsetDias) {
    const data = new Date()
    data.setDate(data.getDate() - offset)
    const dataFormatada = formatarData(data)

    try {
      const resultado = await syncPagamentos(dataFormatada)
      totalNovos += resultado.novos
      totalGeral += resultado.total
      console.log(
        `[sisgruSync] Pagamentos dia ${dataFormatada}: ${resultado.novos} novos / ${resultado.total} total`,
      )
    } catch (err) {
      console.error(
        `[sisgruSync] Erro ao sincronizar Pagamentos do dia ${dataFormatada}: ${(err as Error).message}`,
      )
    }
  }

  return { novos: totalNovos, total: totalGeral }
}

/**
 * Sincroniza apenas pagamentos do dia atual.
 */
async function syncPagamentosDiaAtual(): Promise<void> {
  try {
    console.log('[sisgruSync] Iniciando sync de Pagamentos do dia atual')
    const resultado = await syncPagamentosPorDias([0])
    console.log(
      `[sisgruSync] Pagamentos do dia atual sincronizados: ${resultado.novos} novos / ${resultado.total} total`,
    )
    await registrarLog({
      tipo: 'pagamentos_hoje',
      qtdNovos: resultado.novos,
      qtdTotal: resultado.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro ao sincronizar Pagamentos do dia atual: ${msg}`)
    await registrarLog({
      tipo: 'pagamentos_hoje',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }
}

/**
 * Sincroniza pagamentos dos 5 dias anteriores ao dia atual (D-1 a D-5), um dia por requisição.
 */
async function syncPagamentosUltimos5DiasAnteriores(): Promise<void> {
  try {
    console.log('[sisgruSync] Iniciando sync de Pagamentos dos 5 dias anteriores')
    const resultado = await syncPagamentosPorDias([5, 4, 3, 2, 1])
    console.log(
      `[sisgruSync] Pagamentos dos 5 dias anteriores sincronizados: ${resultado.novos} novos / ${resultado.total} total`,
    )
    await registrarLog({
      tipo: 'pagamentos_anteriores_5d',
      qtdNovos: resultado.novos,
      qtdTotal: resultado.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro ao sincronizar Pagamentos dos 5 dias anteriores: ${msg}`)
    await registrarLog({
      tipo: 'pagamentos_anteriores_5d',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }
}

/**
 * Sincronização manual para data específica (GRUs e pagamentos no mesmo dia).
 * @param dataIso - Data no formato YYYY-MM-DD
 */
async function syncDiaEspecifico(dataIso: string): Promise<void> {
  const dataBr = isoParaDataBr(dataIso)

  try {
    console.log(`[sisgruSync] Iniciando sync manual de GRUs para ${dataBr}`)
    const resultadoGrus = await syncGrus(dataBr)
    console.log(
      `[sisgruSync] GRUs sync manual ${dataBr}: ${resultadoGrus.novos} novos / ${resultadoGrus.total} total`,
    )
    await registrarLog({
      tipo: 'grus_manual_data',
      qtdNovos: resultadoGrus.novos,
      qtdTotal: resultadoGrus.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro no sync manual de GRUs ${dataBr}: ${msg}`)
    await registrarLog({
      tipo: 'grus_manual_data',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }

  try {
    console.log(`[sisgruSync] Iniciando sync manual de Pagamentos para ${dataBr}`)
    const resultadoPag = await syncPagamentos(dataBr)
    console.log(
      `[sisgruSync] Pagamentos sync manual ${dataBr}: ${resultadoPag.novos} novos / ${resultadoPag.total} total`,
    )
    await registrarLog({
      tipo: 'pagamentos_manual_data',
      qtdNovos: resultadoPag.novos,
      qtdTotal: resultadoPag.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro no sync manual de Pagamentos ${dataBr}: ${msg}`)
    await registrarLog({
      tipo: 'pagamentos_manual_data',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }
}

/**
 * Sincronização manual completa de pagamentos: hoje + 5 dias anteriores.
 */
async function syncDia(): Promise<void> {
  await syncGrusUltimos5Dias()
  await syncPagamentosDiaAtual()
  await syncPagamentosUltimos5DiasAnteriores()
}

export {
  syncGrus,
  syncGrusDias,
  syncGrusUltimos5Dias,
  syncPagamentos,
  syncDia,
  syncDiaEspecifico,
  syncPagamentosDiaAtual,
  syncPagamentosUltimos5DiasAnteriores,
}
