import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketStorageGateway,
  getSocketStorageGateways,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: { message: 'Project ref is required' } })
  }

  if (req.method === 'GET') {
    try {
      const gateways = await getSocketStorageGateways(ref)
      return res.status(200).json(gateways)
    } catch (error: any) {
      console.error('Failed to list storage gateways:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to list gateways' } })
    }
  }

  if (req.method === 'POST') {
    const { name, endpoint_url, region, access_key, secret_key } = req.body || {}
    if (!name || !endpoint_url || !access_key || !secret_key) {
      return res.status(400).json({
        error: { message: 'Name, endpoint_url, access_key, and secret_key are required' },
      })
    }

    try {
      const gateway = await createSocketStorageGateway(ref, {
        name,
        endpoint_url,
        region,
        access_key,
        secret_key,
      })
      return res.status(201).json(gateway)
    } catch (error: any) {
      console.error('Failed to create storage gateway:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to create gateway' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
