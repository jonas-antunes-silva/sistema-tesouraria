import cron from 'node-cron'
import { verificarChavePrivada } from '../utils/sisgruJwt'
import { syncDia } from '../services/sisgruSync'

export default defineNitroPlugin(() => {
  // Verificar chave privada na inicialização
  if (!verificarChavePrivada()) {
    console.error(
      '[sisgruCron] ERRO CRÍTICO: Chave privada RSA não encontrada em SISGRU_PRIVATE_KEY_PATH. ' +
        'A sincronização SISGRU está DESABILITADA. Monte o volume correto e reinicie o container.',
    )
    return
  }

  const intervaloMinutos = process.env.SISGRU_SYNC_INTERVAL_MINUTES ?? '10'
  const expressaoCron = `*/${intervaloMinutos} * * * *`

  console.log(
    `[sisgruCron] Sincronização SISGRU agendada com intervalo de ${intervaloMinutos} minuto(s).`,
  )

  cron.schedule(expressaoCron, async () => {
    console.log('[sisgruCron] Iniciando sincronização dos últimos 5 dias')
    try {
      await syncDia()
      console.log('[sisgruCron] Sincronização concluída.')
    } catch (err) {
      console.error(`[sisgruCron] Erro inesperado na sincronização: ${(err as Error).message}`)
    }
  })
})
