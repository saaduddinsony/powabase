import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { executeQuery } from '@/lib/api/self-hosted/query'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

// Allow large payloads up to 100MB for SQL dump restore
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { sql, fileName } = req.body

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: { message: 'Missing SQL content to execute' } })
  }

  try {
    // Execute SQL directly within user database transaction
    const result = await executeQuery({
      query: sql,
      readOnly: false,
    })

    const statementsExecuted = (sql.match(/;/g) || []).length

    return res.status(200).json({
      success: true,
      message: 'Database import completed successfully',
      statementsExecuted: Math.max(1, statementsExecuted),
      fileName: fileName || 'dump.sql',
    })
  } catch (err: any) {
    return res.status(500).json({
      error: {
        message: err.message || 'An error occurred while restoring SQL statements',
      },
    })
  }
}
