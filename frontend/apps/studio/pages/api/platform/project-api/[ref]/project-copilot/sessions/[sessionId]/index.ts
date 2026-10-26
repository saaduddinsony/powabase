import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { deleteCopilotSession } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query
  const sId = Array.isArray(sessionId) ? sessionId[0] : sessionId

  if (!sId) {
    return res.status(400).json({ error: { message: 'Missing sessionId' } })
  }

  try {
    if (req.method === 'DELETE') {
      await deleteCopilotSession(sId)
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', ['DELETE'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  } catch (error: any) {
    console.error('[project-copilot] delete session error:', error)
    return res.status(500).json({ error: { message: error.message || 'Delete session failed' } })
  }
}
