import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { executeQuery } from '@/lib/api/self-hosted/query'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { schema = 'public', includeData = 'true', format = 'sql' } = req.query
  const shouldIncludeData = includeData === 'true'

  try {
    // 1. Fetch tables in schema
    const tablesResult = await executeQuery<{ table_name: string }>({
      query: `SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE'
              ORDER BY table_name;`,
      readOnly: true,
    })

    const tables = tablesResult.data || []

    let dumpOutput = `-- =========================================================\n`
    dumpOutput += `-- Socket BaaS Platform Database Export\n`
    dumpOutput += `-- Target Schema: ${schema}\n`
    dumpOutput += `-- Generated At: ${new Date().toISOString()}\n`
    dumpOutput += `-- Server Version: PostgreSQL\n`
    dumpOutput += `-- =========================================================\n\n`
    dumpOutput += `CREATE SCHEMA IF NOT EXISTS "${schema}";\n\n`

    // 2. Fetch DDL and data for each table
    for (const { table_name } of tables) {
      // Columns
      const columnsResult = await executeQuery<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>({
        query: `SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_schema = '${schema}' AND table_name = '${table_name}' 
                ORDER BY ordinal_position;`,
        readOnly: true,
      })

      const cols = columnsResult.data || []
      if (cols.length > 0) {
        dumpOutput += `-- Table definition: "${schema}"."${table_name}"\n`
        dumpOutput += `DROP TABLE IF EXISTS "${schema}"."${table_name}" CASCADE;\n`
        dumpOutput += `CREATE TABLE "${schema}"."${table_name}" (\n`

        const colDefs = cols.map((c) => {
          let line = `  "${c.column_name}" ${c.data_type.toUpperCase()}`
          if (c.column_default) line += ` DEFAULT ${c.column_default}`
          if (c.is_nullable === 'NO') line += ` NOT NULL`
          return line
        })

        dumpOutput += colDefs.join(',\n')
        dumpOutput += `\n);\n\n`
      }

      // Data rows if requested
      if (shouldIncludeData) {
        const rowsResult = await executeQuery<Record<string, any>>({
          query: `SELECT * FROM "${schema}"."${table_name}" LIMIT 5000;`,
          readOnly: true,
        })

        const rows = rowsResult.data || []
        if (rows.length > 0) {
          dumpOutput += `-- Dumping ${rows.length} rows for "${schema}"."${table_name}"\n`
          for (const row of rows) {
            const keys = Object.keys(row).map((k) => `"${k}"`).join(', ')
            const vals = Object.values(row)
              .map((v) => {
                if (v === null || v === undefined) return 'NULL'
                if (typeof v === 'number') return v
                if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
                if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
                return `'${String(v).replace(/'/g, "''")}'`
              })
              .join(', ')

            dumpOutput += `INSERT INTO "${schema}"."${table_name}" (${keys}) VALUES (${vals});\n`
          }
          dumpOutput += `\n`
        }
      }
    }

    dumpOutput += `-- End of dump\n`

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="socket-export-${schema}-${new Date().toISOString().split('T')[0]}.sql"`
    )
    return res.status(200).send(dumpOutput)
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to export database' } })
  }
}
