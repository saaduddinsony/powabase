import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketAuditLogs } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  try {
    const logs = await getSocketAuditLogs()
    return res.status(200).json({
      result: logs,
      retention_period: 30,
    })
  } catch (error: any) {
    console.error('Failed to get organization audit logs:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to get audit logs' } })
  }
}
