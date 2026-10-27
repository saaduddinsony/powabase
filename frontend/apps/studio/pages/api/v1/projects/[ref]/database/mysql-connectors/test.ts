import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { testSocketMySQLConnector } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { host, port, database_name, username, password } = req.body || {}
  if (!host || !database_name || !username || !password) {
    return res.status(400).json({
      error: { message: 'host, database_name, username, and password are required' },
    })
  }

  try {
    const result = await testSocketMySQLConnector({
      host,
      port: port ? parseInt(port, 10) : 3306,
      database_name,
      username,
      password,
    })

    if (result.success) {
      return res.status(200).json(result)
    } else {
      return res.status(400).json(result)
    }
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Connection test failed',
    })
  }
}
