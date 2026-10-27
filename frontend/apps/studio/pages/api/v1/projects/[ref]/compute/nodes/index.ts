import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  getSocketComputeNodes,
  registerSocketComputeNode,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'

  if (req.method === 'GET') {
    try {
      const nodes = await getSocketComputeNodes(projectRef)
      return res.status(200).json(nodes)
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to get compute nodes' } })
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, role } = req.body || {}
      if (!name) {
        return res.status(400).json({ error: { message: 'name is required' } })
      }

      const node = await registerSocketComputeNode(projectRef, name, role || 'worker')
      return res.status(201).json(node)
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to register node' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
