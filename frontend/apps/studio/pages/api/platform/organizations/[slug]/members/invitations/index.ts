import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketOrganizationInvitation,
  getSocketOrganizationInvitations,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: { message: 'Organization slug is required' } })
  }

  if (req.method === 'GET') {
    try {
      const invites = await getSocketOrganizationInvitations(slug)
      return res.status(200).json({
        invitations: invites.map((inv) => ({
          id: inv.id,
          invited_at: inv.invited_at,
          invited_email: inv.invited_email,
          role_id: inv.role_id,
          role_scoped_projects: inv.role_scoped_projects || [],
          token: inv.token,
        })),
      })
    } catch (error: any) {
      console.error('Failed to list invitations:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to list invitations' } })
    }
  }

  if (req.method === 'POST') {
    const { email, role_id, role_scoped_projects } = req.body || {}
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: { message: 'Email is required' } })
    }

    try {
      const roleId = Number(role_id) || 3
      const invite = await createSocketOrganizationInvitation(
        slug,
        email,
        roleId,
        Array.isArray(role_scoped_projects) ? role_scoped_projects : []
      )

      return res.status(201).json({
        id: invite.id,
        invited_at: invite.invited_at,
        invited_email: invite.invited_email,
        role_id: invite.role_id,
        role_scoped_projects: invite.role_scoped_projects,
        token: invite.token,
      })
    } catch (error: any) {
      console.error('Failed to create invitation:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to create invitation' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
