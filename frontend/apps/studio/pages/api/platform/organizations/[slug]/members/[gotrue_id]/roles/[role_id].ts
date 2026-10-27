import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { updateSocketOrganizationMemberRole } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug, gotrue_id, role_id } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: { message: 'Organization slug is required' } })
  }
  if (!gotrue_id || typeof gotrue_id !== 'string') {
    return res.status(400).json({ error: { message: 'Member identifier is required' } })
  }

  // DELETE: Unassign role from member (defaults back to Developer role 3)
  if (req.method === 'DELETE') {
    try {
      await updateSocketOrganizationMemberRole(slug, gotrue_id, 3, [])
      return res.status(200).json({ success: true })
    } catch (error: any) {
      console.error('Failed to unassign member role:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to unassign role' } })
    }
  }

  res.setHeader('Allow', ['DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
