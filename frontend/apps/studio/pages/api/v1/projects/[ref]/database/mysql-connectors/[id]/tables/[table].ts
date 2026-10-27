import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketMySQLConnectorTableData } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id, table } = req.query
  const connectorId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)
  const tableName = Array.isArray(table) ? table[0] : table || ''

  if (isNaN(connectorId) || !tableName) {
    return res.status(400).json({ error: { message: 'Invalid connector ID or table name' } })
  }

  try {
    const data = await getSocketMySQLConnectorTableData(connectorId, tableName)
    return res.status(200).json(data)
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to get table rows' } })
  }
}
