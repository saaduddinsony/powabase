import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getOrCreateCopilotSession } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'

  try {
    if (req.method === 'GET') {
      const session = await getOrCreateCopilotSession(projectRef)
      return res.status(200).json({ session })
    }

    if (req.method === 'POST') {
      const session = await getOrCreateCopilotSession(projectRef)
      return res.status(200).json({ id: session.id })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  } catch (error: any) {
    console.error('[project-copilot] sessions error:', error)
    return res.status(500).json({ error: { message: error.message || 'Copilot session error' } })
  }
}
