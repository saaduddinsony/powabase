import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getCopilotSettings, updateCopilotSettings } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'

  try {
    if (req.method === 'GET') {
      const settings = await getCopilotSettings(projectRef)
      return res.status(200).json(settings)
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const { warn_on_delete, model } = req.body || {}
      await updateCopilotSettings(projectRef, { warn_on_delete, model })
      return res.status(200).json({ success: true, warn_on_delete, model })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  } catch (error: any) {
    console.error('[project-copilot] settings error:', error)
    return res.status(500).json({ error: { message: error.message || 'Settings failed' } })
  }
}
