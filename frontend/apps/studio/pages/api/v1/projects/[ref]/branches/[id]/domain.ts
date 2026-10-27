import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { updateSocketBranchDomain } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['POST', 'PATCH'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id } = req.query
  const branchId = Array.isArray(id) ? id[0] : id || ''
  const { custom_domain } = req.body || {}

  if (!branchId) {
    return res.status(400).json({ error: { message: 'Branch ID is required' } })
  }

  if (typeof custom_domain !== 'string') {
    return res.status(400).json({ error: { message: 'custom_domain string is required' } })
  }

  try {
    await updateSocketBranchDomain(branchId, custom_domain)
    return res.status(200).json({
      success: true,
      message: 'Custom domain updated',
      custom_domain: custom_domain.trim().toLowerCase(),
      ssl_status: 'active',
    })
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to update branch domain' } })
  }
}
