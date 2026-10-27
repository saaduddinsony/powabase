import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { syncSocketMySQLConnector } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id } = req.query
  const connectorId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)

  if (isNaN(connectorId)) {
    return res.status(400).json({ error: { message: 'Invalid connector ID' } })
  }

  try {
    const result = await syncSocketMySQLConnector(connectorId)
    return res.status(200).json(result)
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to sync MySQL schema' } })
  }
}
