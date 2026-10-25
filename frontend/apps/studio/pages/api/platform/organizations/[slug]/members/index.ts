import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketOrganizationMembers } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: { message: 'Organization slug is required' } })
  }

  if (req.method === 'GET') {
    try {
      const members = await getSocketOrganizationMembers(slug)
      const mapped = members.map((m) => ({
        id: m.id,
        is_owner: m.role_id === 1,
        primary_email: m.primary_email,
        username: m.username || m.primary_email.split('@')[0],
        role_ids: [m.role_id],
        project_scoped_roles: m.project_scoped_roles || [],
        mfa_enabled: m.mfa_enabled || false,
        gotrue_id: m.gotrue_id || `user-${m.id}`,
        created_at: m.created_at,
      }))
      return res.status(200).json(mapped)
    } catch (error: any) {
      console.error('Failed to list organization members:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to list members' } })
    }
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
