import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { deleteSocketMySQLConnector } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const connectorId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)

  if (isNaN(connectorId)) {
    return res.status(400).json({ error: { message: 'Invalid connector ID' } })
  }

  if (req.method === 'DELETE') {
    try {
      await deleteSocketMySQLConnector(connectorId)
      return res.status(200).json({ success: true, message: 'MySQL connector deleted successfully' })
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to delete connector' } })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { auto_sync_enabled, sync_interval_mins } = req.body || {}
      const { updateSocketMySQLConnector } = await import('@/lib/api/self-hosted/metadata')
      await updateSocketMySQLConnector(connectorId, {
        auto_sync_enabled,
        sync_interval_mins,
      })
      return res.status(200).json({ success: true, message: 'Sync settings updated' })
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to update sync settings' } })
    }
  }

  res.setHeader('Allow', ['DELETE', 'PATCH'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
