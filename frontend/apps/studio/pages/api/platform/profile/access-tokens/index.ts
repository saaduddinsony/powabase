import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  getSocketPersonalAccessTokens,
  createSocketPersonalAccessToken,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const tokens = await getSocketPersonalAccessTokens()
      return res.status(200).json(tokens)
    } catch (error: any) {
      console.error('Failed to list access tokens:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to list access tokens' } })
    }
  }

  if (req.method === 'POST') {
    const { name, scope, expires_at } = req.body || {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: { message: 'Token name is required' } })
    }

    try {
      const newToken = await createSocketPersonalAccessToken({
        name,
        scope,
        expires_at,
      })
      return res.status(201).json(newToken)
    } catch (error: any) {
      console.error('Failed to create access token:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to create access token' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
