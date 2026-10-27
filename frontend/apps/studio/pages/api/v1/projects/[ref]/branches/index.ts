import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketBranch,
  getSocketBranches,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const ref = req.query.ref as string
  try {
    const branches = await getSocketBranches(ref)
    return res.status(200).json(branches)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to list branches' } })
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const ref = req.query.ref as string
  const { branch_name, branchName, git_branch, gitBranch, with_data, withData } = req.body || {}

  const name = branch_name || branchName
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: { message: 'Branch name is required' } })
  }

  try {
    const branch = await createSocketBranch({
      projectRef: ref,
      branchName: name,
      gitBranch: git_branch || gitBranch,
      withData: with_data ?? withData ?? true,
    })
    return res.status(201).json(branch)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to create branch' } })
  }
}
