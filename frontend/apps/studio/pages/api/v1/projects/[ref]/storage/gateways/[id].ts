import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { deleteSocketStorageGateway } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const numericId = parseInt(id as string, 10)
  if (isNaN(numericId)) {
    return res.status(400).json({ error: { message: 'Valid gateway ID is required' } })
  }

  if (req.method === 'DELETE') {
    try {
      await deleteSocketStorageGateway(numericId)
      return res.status(200).json({ success: true })
    } catch (error: any) {
      console.error('Failed to delete storage gateway:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to delete gateway' } })
    }
  }

  res.setHeader('Allow', ['DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
