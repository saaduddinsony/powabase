import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { listRemoteGatewayBuckets } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id } = req.query
  const gatewayId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)

  if (isNaN(gatewayId)) {
    return res.status(400).json({ error: { message: 'Invalid gateway ID' } })
  }

  try {
    const buckets = await listRemoteGatewayBuckets(gatewayId)
    return res.status(200).json(buckets)
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to list buckets' } })
  }
}
