import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketMySQLConnector,
  getSocketMySQLConnectors,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'

  if (req.method === 'GET') {
    try {
      const connectors = await getSocketMySQLConnectors(projectRef)
      return res.status(200).json(connectors)
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to get MySQL connectors' } })
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, host, port, database_name, username, password, foreign_schema } = req.body || {}

      if (!name || !host || !database_name || !username || !password || !foreign_schema) {
        return res.status(400).json({
          error: { message: 'name, host, database_name, username, password, and foreign_schema are required' },
        })
      }

      const connector = await createSocketMySQLConnector(projectRef, {
        name,
        host,
        port: port ? parseInt(port, 10) : 3306,
        database_name,
        username,
        password,
        foreign_schema,
      })

      return res.status(201).json(connector)
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to create MySQL connector' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
