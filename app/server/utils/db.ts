import { Pool, type PoolClient } from 'pg'

// Pool de conexões — criado uma única vez na inicialização do servidor
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  // Loga no servidor, nunca expõe ao cliente
  console.error('[db] Erro inesperado no pool de conexões:', err.message)
})

/**
 * Executa uma query parametrizada.
 * NUNCA use interpolação de strings SQL — apenas parâmetros posicionais ($1, $2, ...).
 */
async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const result = await pool.query<T>(sql, params)
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    }
  } catch (err) {
    console.error('[db] Erro ao executar query:', (err as Error).message)
    throw new Error('Erro interno no banco de dados')
  }
}

/**
 * Executa um conjunto de operações dentro de uma transação.
 * BEGIN/COMMIT/ROLLBACK são gerenciados automaticamente.
 */
async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[db] Transação revertida:', (err as Error).message)
    throw new Error('Erro interno no banco de dados')
  } finally {
    client.release()
  }
}

export { pool, query, transaction }
