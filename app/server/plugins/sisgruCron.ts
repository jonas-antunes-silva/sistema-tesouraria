import cron from 'node-cron'
import { verificarChavePrivada } from '../utils/sisgruJwt'
import {
  syncGrusUltimos5Dias,
  syncPagamentosDiaAtual,
  syncPagamentosUltimos5DiasAnteriores,
} from '../services/sisgruSync'

export default defineNitroPlugin(() => {
  // Verificar chave privada na inicialização
  if (!verificarChavePrivada()) {
    console.error(
      '[sisgruCron] ERRO CRÍTICO: Chave privada RSA não encontrada em SISGRU_PRIVATE_KEY_PATH. ' +
        'A sincronização SISGRU está DESABILITADA. Monte o volume correto e reinicie o container.',
    )
    return
  }

  let executandoHoje = false
  let executandoAnteriores = false
  let executandoGrus = false

  console.log(
    '[sisgruCron] Agendamentos SISGRU ativos: pagamentos hoje a cada 30 seg; pagamentos D-1..D-5 a cada 5 min; GRUs últimos 5 dias a cada 10 min.',
  )

  cron.schedule('*/30 * * * * *', async () => {
    if (executandoHoje) {
      console.log('[sisgruCron] Sync dia atual ignorada: execução anterior ainda em andamento.')
      return
    }

    executandoHoje = true
    try {
      await syncPagamentosDiaAtual()
    } catch (err) {
      console.error(`[sisgruCron] Erro inesperado no sync do dia atual: ${(err as Error).message}`)
    } finally {
      executandoHoje = false
    }
  })

  cron.schedule('*/5 * * * *', async () => {
    if (executandoAnteriores) {
      console.log('[sisgruCron] Sync D-1..D-5 ignorada: execução anterior ainda em andamento.')
      return
    }

    executandoAnteriores = true
    try {
      await syncPagamentosUltimos5DiasAnteriores()
    } catch (err) {
      console.error(`[sisgruCron] Erro inesperado no sync D-1..D-5: ${(err as Error).message}`)
    } finally {
      executandoAnteriores = false
    }
  })

  cron.schedule('*/10 * * * *', async () => {
    if (executandoGrus) {
      console.log('[sisgruCron] Sync GRUs ignorada: execução anterior ainda em andamento.')
      return
    }

    executandoGrus = true
    try {
      await syncGrusUltimos5Dias()
    } catch (err) {
      console.error(`[sisgruCron] Erro inesperado no sync de GRUs: ${(err as Error).message}`)
    } finally {
      executandoGrus = false
    }
  })
})
