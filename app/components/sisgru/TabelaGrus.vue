<template>
  <div class="overflow-x-auto">
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>ID</th>
          <th>Contribuinte</th>
          <th>Serviço</th>
          <th>numReferencia</th>
          <th>Situação</th>
          <th>origemGRU</th>
          <th>Meio Pagamento</th>
          <th>Ident. Pagto.</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="grus.length === 0">
          <td colspan="8" class="text-center text-base-content/60 py-8">
            Nenhum registro encontrado
          </td>
        </tr>
        <tr v-for="gru in grus" :key="gru.id">
          <td class="font-mono text-xs">{{ gru.id }}</td>
          <td>{{ gru.codigo_recolhedor }}</td>
          <td>{{ gru.servico }}</td>
          <td>{{ gru.num_referencia ?? '—' }}</td>
          <td>{{ formatarSituacao(gru.situacao) }}</td>
          <td>{{ formatarOrigemGru(gru.origem_gru) }}</td>
          <td>{{ gru.meio_pagamento }}</td>
          <td>
            <button
              class="link link-primary text-xs"
              :title="`Ver detalhes do pagamento ${gru.codigo_pagamento}`"
              @click="abrirPagamento(gru.codigo_pagamento)"
            >
              {{ gru.codigo_pagamento }}
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="grus.length > 0">
        <tr>
          <td colspan="8" class="font-semibold">
            Total: {{ grus.length }} registro{{ grus.length !== 1 ? 's' : '' }}
          </td>
        </tr>
      </tfoot>
    </table>

    <dialog ref="pagamentoModal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg">Detalhes do Pagamento</h3>
        <p v-if="codigoSelecionado" class="text-sm text-base-content/70 mt-1">
          Ident. Pagto.: {{ codigoSelecionado }}
        </p>

        <div v-if="carregandoPagamento" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="erroPagamento" class="alert alert-error mt-4">
          <span>{{ erroPagamento }}</span>
        </div>

        <div v-else-if="pagamentoSelecionado" class="overflow-x-auto mt-4">
          <table class="table table-sm">
            <tbody>
              <tr>
                <th>ID</th>
                <td>{{ pagamentoSelecionado.id }}</td>
              </tr>
              <tr>
                <th>Código</th>
                <td>{{ pagamentoSelecionado.codigo }}</td>
              </tr>
              <tr>
                <th>Contribuinte</th>
                <td>{{ pagamentoSelecionado.nome_contribuinte }}</td>
              </tr>
              <tr>
                <th>CPF/CNPJ</th>
                <td>{{ pagamentoSelecionado.codigo_contribuinte }}</td>
              </tr>
              <tr>
                <th>Serviço</th>
                <td>{{ pagamentoSelecionado.servico_nome }} ({{ pagamentoSelecionado.servico_id }})</td>
              </tr>
              <tr>
                <th>Referência</th>
                <td>{{ pagamentoSelecionado.numero_referencia ?? '—' }}</td>
              </tr>
              <tr>
                <th>Situação</th>
                <td>{{ pagamentoSelecionado.situacao }}</td>
              </tr>
              <tr>
                <th>Tipo de pagamento</th>
                <td>{{ pagamentoSelecionado.tipo_pagamento_nome }}</td>
              </tr>
              <tr>
                <th>Valor total</th>
                <td>{{ formatarMoeda(pagamentoSelecionado.valor_total) }}</td>
              </tr>
              <tr>
                <th>Data</th>
                <td>{{ formatarDataHora(pagamentoSelecionado.data) }}</td>
              </tr>
              <tr>
                <th>Pagamento PSP</th>
                <td>{{ formatarDataHora(pagamentoSelecionado.data_pagamento_psp) }}</td>
              </tr>
              <tr>
                <th>Alteração Situação Tesouro</th>
                <td>{{ formatarDataHora(pagamentoSelecionado.data_alteracao_situacao_pag_tesouro) }}</td>
              </tr>
              <tr>
                <th>Sincronizado em</th>
                <td>{{ formatarDataHora(pagamentoSelecionado.sincronizado_em) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-action">
          <button class="btn" @click="fecharPagamento">Fechar</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="fecharPagamento">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
export interface GruRow {
  id: string
  codigo_recolhedor: string
  servico: number
  num_referencia?: number | string | null
  origem_gru?: number | string | null
  tipo_servico: number
  vl_total: number
  situacao: string
  dt_emissao: string
  dt_transferencia?: string
  meio_pagamento: string
  dt_criacao_sisgru: string
  codigo_pagamento: string
  dt_criacao: string
  sincronizado_em: string
}

interface PagamentoDetalhe {
  id: number
  codigo: string
  codigo_contribuinte: string
  nome_contribuinte: string
  numero_referencia: number | null
  servico_id: number
  servico_nome: string
  situacao: string
  tipo_pagamento_nome: string
  valor_total: number
  data: string | null
  data_pagamento_psp: string | null
  data_alteracao_situacao_pag_tesouro: string | null
  sincronizado_em: string
}

const props = defineProps<{
  grus: GruRow[]
}>()

const pagamentoModal = ref<HTMLDialogElement | null>(null)
const carregandoPagamento = ref(false)
const codigoSelecionado = ref<string | null>(null)
const erroPagamento = ref<string | null>(null)
const pagamentoSelecionado = ref<PagamentoDetalhe | null>(null)

function mensagemErro(err: unknown): string {
  if (err && typeof err === 'object') {
    const data = (err as { data?: { statusMessage?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if ('statusMessage' in err) return String((err as { statusMessage: string }).statusMessage)
  }
  return 'Nao foi possivel carregar o pagamento.'
}

async function abrirPagamento(codigoPagamento: string): Promise<void> {
  codigoSelecionado.value = codigoPagamento
  carregandoPagamento.value = true
  erroPagamento.value = null
  pagamentoSelecionado.value = null
  pagamentoModal.value?.showModal()

  try {
    pagamentoSelecionado.value = await $fetch<PagamentoDetalhe>(
      `/api/sisgru/pagamentos/por-codigo?codigo=${encodeURIComponent(codigoPagamento)}`,
    )
  } catch (err: unknown) {
    erroPagamento.value = mensagemErro(err)
  } finally {
    carregandoPagamento.value = false
  }
}

function fecharPagamento(): void {
  pagamentoModal.value?.close()
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarSituacao(codigo: string): string {
  const mapa: Record<string, string> = {
    '02': 'Contabilizado',
    '03': 'Pendente de Contabilizacao',
    '04': 'Restituido (em desuso)',
    '05': 'Pendente de Restituicao (em desuso)',
    '06': 'Retificado',
    '07': 'Pendente de Retificacao',
    '08': 'Cancelado',
  }

  return mapa[codigo] ? `${codigo} - ${mapa[codigo]}` : codigo
}

function formatarOrigemGru(origem: number | string | null | undefined): string {
  if (origem == null || origem === '') return '—'

  const codigo = String(origem)
  const mapa: Record<string, string> = {
    '1': 'Boleto',
    '2': 'Intrasiafi Ou Spb',
    '3': 'Debito Em Conta',
    '4': 'Picpay',
    '5': 'PagoParcelado',
    '6': 'Mercado Pago',
    '7': 'Arrecadacao Gru via Pix',
  }

  return mapa[codigo] ? `${codigo} - ${mapa[codigo]}` : codigo
}

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '—'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    let h = parseInt(hour, 10) - 3
    let d = parseInt(day, 10)
    let m = parseInt(month, 10)
    let y = parseInt(year, 10)
    if (h < 0) {
      h += 24
      d -= 1
      if (d < 1) {
        m -= 1
        if (m < 1) {
          m = 12
          y -= 1
        }
        const diasNoMes = new Date(y, m, 0).getDate()
        d = diasNoMes
      }
    }
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} ${String(h).padStart(2, '0')}:${minute}`
  }
  return data
}
</script>
