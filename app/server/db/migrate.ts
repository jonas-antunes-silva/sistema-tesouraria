/**
 * Script de migração do banco de dados.
 *
 * Executa todos os arquivos .sql de server/db/migrations/ em ordem alfabética,
 * controlando quais já foram aplicados via tabela _migrations.
 *
 * Uso:
 *   docker compose exec nuxt npx tsx server/db/migrate.ts
 *
 * Requisitos: 6.1
 */

import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function ensureMigrationsTable(client: Awaited<ReturnType<typeof pool.connect>>): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      nome        VARCHAR(255) UNIQUE NOT NULL,
      aplicado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(client: Awaited<ReturnType<typeof pool.connect>>): Promise<Set<string>> {
  const result = await client.query<{ nome: string }>('SELECT nome FROM _migrations ORDER BY id')
  return new Set(result.rows.map((r) => r.nome))
}

async function runMigration(
  client: Awaited<ReturnType<typeof pool.connect>>,
  nome: string,
  sql: string,
): Promise<void> {
  console.log(`[migrate] Aplicando: ${nome}`)
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('INSERT INTO _migrations (nome) VALUES ($1)', [nome])
    await client.query('COMMIT')
    console.log(`[migrate] ✓ ${nome}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function main(): Promise<void> {
  // Caminho relativo ao diretório de execução (app/)
  const migrationsDir = path.resolve(process.cwd(), 'server/db/migrations')

  if (!fs.existsSync(migrationsDir)) {
    console.error(`[migrate] Diretório não encontrado: ${migrationsDir}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort() // ordem alfabética garante sequência numérica (001_, 002_, ...)

  if (files.length === 0) {
    console.log('[migrate] Nenhum arquivo de migration encontrado.')
    process.exit(0)
  }

  const client = await pool.connect()
  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)

    let count = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] Ignorando (já aplicada): ${file}`)
        continue
      }

      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')
      await runMigration(client, file, sql)
      count++
    }

    if (count === 0) {
      console.log('[migrate] Banco de dados já está atualizado.')
    } else {
      console.log(`[migrate] ${count} migration(s) aplicada(s) com sucesso.`)
    }
  } catch (err) {
    console.error('[migrate] Erro durante a migração:', (err as Error).message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
