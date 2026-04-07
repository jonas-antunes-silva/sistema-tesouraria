import cron from 'node-cron'
import { verificarChavePrivada } from '../utils/sisgruJwt'
import { syncPagamentosDiaAtual, syncPagamentosUltimos5DiasAnteriores } from '../services/sisgruSync'

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

  console.log('[sisgruCron] Agendamentos SISGRU ativos: hoje a cada 1 min; D-1..D-5 a cada 20 min.')

  cron.schedule('* * * * *', async () => {
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

  cron.schedule('*/20 * * * *', async () => {
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
})
