import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { deleteSocketPersonalAccessToken } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
    return res.status(400).json({ error: { message: 'Token id is required' } })
  }

  if (req.method === 'DELETE') {
    try {
      await deleteSocketPersonalAccessToken(id as string | number)
      return res.status(200).json({ success: true })
    } catch (error: any) {
      console.error('Failed to delete access token:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to delete access token' } })
    }
  }

  res.setHeader('Allow', ['DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
