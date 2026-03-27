import { gerarJwtSisgru } from '../utils/sisgruJwt'
import { parseGrus, parsePagamentos } from '../utils/sisgruParser'
import { query } from '../utils/db'

const SISGRU_URL_BASE = process.env.SISGRU_URL_BASE ?? ''
const SISGRU_UG = process.env.SISGRU_UG ?? ''

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
 * Sincroniza Pagamentos do SISGRU para o banco de dados.
 * @param data - Data no formato DD/MM/YYYY
 * Para pagamentos com servico_id = 16279, acumula créditos em reprografia_creditos.
 */
async function syncPagamentos(data: string): Promise<{ novos: number; total: number }> {
  const jwt = gerarJwtSisgru()
  const intervalo = `${data}-${data}`
  const filtros = `ug=${SISGRU_UG}&dataAlteracaoSituacaoPagTesouro=${intervalo}`
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

      // Acumular créditos de reprografia apenas para pagamentos novos com servico_id = 16279 e situação CO (Concluído)
      if (pag.servicoId === 16279 && pag.situacao === 'CO') {
        await query(
          `INSERT INTO reprografia_creditos (cpf, nome, saldo)
           VALUES ($1, $2, $3)
           ON CONFLICT (cpf) DO UPDATE
             SET saldo = reprografia_creditos.saldo + EXCLUDED.saldo,
                 nome = EXCLUDED.nome,
                 atualizado_em = NOW()`,
          [pag.codigoContribuinte, pag.nomeContribuinte.trim(), pag.valorTotal],
        )
      }
    }
  }

  return { novos, total: pagamentos.length }
}

/**
 * Sincroniza Pagamentos dos últimos 5 dias, um dia por requisição.
 */
async function syncPagamentosDias(): Promise<{ novos: number; total: number }> {
  let totalNovos = 0
  let totalGeral = 0

  for (let i = 4; i >= 0; i--) {
    const data = new Date()
    data.setDate(data.getDate() - i)
    const dataFormatada = formatarData(data)

    try {
      const resultado = await syncPagamentos(dataFormatada)
      totalNovos += resultado.novos
      totalGeral += resultado.total
      console.log(`[sisgruSync] Pagamentos dia ${dataFormatada}: ${resultado.novos} novos / ${resultado.total} total`)
    } catch (err) {
      console.error(`[sisgruSync] Erro ao sincronizar Pagamentos do dia ${dataFormatada}: ${(err as Error).message}`)
    }
  }

  return { novos: totalNovos, total: totalGeral }
}

/**
 * Sincroniza GRUs e Pagamentos dos últimos 5 dias, um dia por requisição.
 */
async function syncDia(): Promise<void> {
  // Sincronizar GRUs (últimos 5 dias, um por requisição) - DESATIVADO
  // try {
  //   console.log('[sisgruSync] Iniciando sync de GRUs (últimos 5 dias)')
  //   const resultado = await syncGrusDias()
  //   console.log(
  //     `[sisgruSync] GRUs sincronizados: ${resultado.novos} novos / ${resultado.total} total`,
  //   )
  //   await registrarLog({
  //     tipo: 'grus',
  //     qtdNovos: resultado.novos,
  //     qtdTotal: resultado.total,
  //     status: 'sucesso',
  //   })
  // } catch (err) {
  //   const msg = (err as Error).message
  //   console.error(`[sisgruSync] Erro ao sincronizar GRUs: ${msg}`)
  //   await registrarLog({
  //     tipo: 'grus',
  //     qtdNovos: null,
  //     qtdTotal: null,
  //     status: 'erro',
  //     mensagemErro: msg,
  //   })
  // }

  // Sincronizar Pagamentos (últimos 5 dias, um por requisição)
  try {
    console.log('[sisgruSync] Iniciando sync de Pagamentos (últimos 5 dias)')
    const resultado = await syncPagamentosDias()
    console.log(
      `[sisgruSync] Pagamentos sincronizados: ${resultado.novos} novos / ${resultado.total} total`,
    )
    await registrarLog({
      tipo: 'pagamentos',
      qtdNovos: resultado.novos,
      qtdTotal: resultado.total,
      status: 'sucesso',
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[sisgruSync] Erro ao sincronizar Pagamentos: ${msg}`)
    await registrarLog({
      tipo: 'pagamentos',
      qtdNovos: null,
      qtdTotal: null,
      status: 'erro',
      mensagemErro: msg,
    })
  }
}

export { syncGrus, syncPagamentos, syncDia }
