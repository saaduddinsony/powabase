import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  deleteRemoteGatewayFile,
  listRemoteGatewayFiles,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, bucket, prefix } = req.query
  const gatewayId = parseInt(Array.isArray(id) ? id[0] : id || '', 10)
  const bucketName = (Array.isArray(bucket) ? bucket[0] : bucket) || 'default'
  const prefixStr = Array.isArray(prefix) ? prefix[0] : prefix || ''

  if (isNaN(gatewayId)) {
    return res.status(400).json({ error: { message: 'Invalid gateway ID' } })
  }

  if (req.method === 'GET') {
    try {
      const files = await listRemoteGatewayFiles(gatewayId, bucketName, prefixStr)
      return res.status(200).json(files)
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to list files' } })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { key } = req.body || {}
      if (!key) {
        return res.status(400).json({ error: { message: 'key is required' } })
      }
      await deleteRemoteGatewayFile(gatewayId, bucketName, key)
      return res.status(200).json({ success: true, message: 'File deleted' })
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to delete file' } })
    }
  }

  res.setHeader('Allow', ['GET', 'DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
