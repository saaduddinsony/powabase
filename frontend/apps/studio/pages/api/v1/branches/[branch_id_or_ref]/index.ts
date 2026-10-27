import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  deleteSocketBranch,
  getSocketBranchByIdOrRef,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const branchIdOrRef = req.query.branch_id_or_ref as string
  try {
    const branch = await getSocketBranchByIdOrRef(branchIdOrRef)
    if (!branch) {
      return res.status(404).json({ error: { message: 'Branch not found' } })
    }
    return res.status(200).json(branch)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to get branch' } })
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const branchIdOrRef = req.query.branch_id_or_ref as string
  try {
    const success = await deleteSocketBranch(branchIdOrRef)
    if (!success) {
      return res.status(404).json({ error: { message: 'Branch not found' } })
    }
    return res.status(200).json({ success: true })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to delete branch' } })
  }
}
