import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

// In-memory / mock store for self-hosted third-party auth integrations
const integrationsStore: Record<string, any[]> = {}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const { ref } = req.query
  const projectRef = (typeof ref === 'string' ? ref : ref?.[0]) || 'default'

  if (!integrationsStore[projectRef]) {
    integrationsStore[projectRef] = []
  }

  switch (method) {
    case 'GET':
      return res.status(200).json(integrationsStore[projectRef])

    case 'POST': {
      const integration = {
        id: `tpa-${Date.now()}`,
        ...req.body,
        inserted_at: new Date().toISOString(),
      }
      integrationsStore[projectRef].push(integration)
      return res.status(201).json(integration)
    }

    case 'DELETE': {
      const { id } = req.body || {}
      integrationsStore[projectRef] = integrationsStore[projectRef].filter((item) => item.id !== id)
      return res.status(200).json({ success: true })
    }

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}
