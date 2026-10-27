import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSigV4PresignedUrl,
  getSocketStorageGatewayById,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id } = req.query
  const gatewayId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)

  if (isNaN(gatewayId)) {
    return res.status(400).json({ error: { message: 'Invalid gateway ID' } })
  }

  const { bucket, key, expires_in, operation } = req.body || {}
  if (!bucket || !key) {
    return res.status(400).json({ error: { message: 'bucket and key are required' } })
  }

  try {
    const gw = await getSocketStorageGatewayById(gatewayId)
    if (!gw) {
      return res.status(404).json({ error: { message: 'Gateway not found' } })
    }

    const url = createSigV4PresignedUrl({
      endpointUrl: gw.endpoint_url,
      region: gw.region || 'us-east-1',
      accessKey: gw.access_key,
      secretKey: gw.secret_key,
      bucket,
      key,
      expiresIn: typeof expires_in === 'number' ? expires_in : 3600,
      method: operation === 'PUT' ? 'PUT' : 'GET',
    })

    return res.status(200).json({ url, expires_in: expires_in || 3600 })
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to create presigned URL' } })
  }
}
