import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketOrganization,
  getSocketOrganizations,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'POST':
      return handleCreate(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const orgs = await getSocketOrganizations()
    return res.status(200).json(orgs)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to list organizations' } })
  }
}

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: { message: 'Organization name is required' } })
  }

  try {
    const org = await createSocketOrganization({ name: name.trim() })
    return res.status(201).json(org)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to create organization' } })
  }
}
