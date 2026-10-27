import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  deleteSocketOrganizationMember,
  updateSocketOrganizationMemberRole,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug, gotrue_id } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: { message: 'Organization slug is required' } })
  }
  if (!gotrue_id || typeof gotrue_id !== 'string') {
    return res.status(400).json({ error: { message: 'Member identifier is required' } })
  }

  // DELETE: Delete member from organization
  if (req.method === 'DELETE') {
    try {
      await deleteSocketOrganizationMember(slug, gotrue_id)
      return res.status(200).json({ success: true })
    } catch (error: any) {
      console.error('Failed to delete member:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to remove member' } })
    }
  }

  // PATCH: Update member's role or project-scoped roles
  if (req.method === 'PATCH') {
    try {
      const { role_id, role_scoped_projects, projects } = req.body || {}
      const targetRoleId = Number(role_id)
      if (!targetRoleId || isNaN(targetRoleId)) {
        return res.status(400).json({ error: { message: 'Valid role_id is required' } })
      }

      const projectList = Array.isArray(role_scoped_projects)
        ? role_scoped_projects
        : Array.isArray(projects)
          ? projects
          : undefined

      const updated = await updateSocketOrganizationMemberRole(
        slug,
        gotrue_id,
        targetRoleId,
        projectList
      )

      return res.status(200).json({
        id: updated.id,
        is_owner: updated.role_id === 1,
        primary_email: updated.primary_email,
        username: updated.username || updated.primary_email.split('@')[0],
        role_ids: [updated.role_id],
        project_scoped_roles: updated.project_scoped_roles || [],
        mfa_enabled: updated.mfa_enabled || false,
        gotrue_id: updated.gotrue_id,
      })
    } catch (error: any) {
      console.error('Failed to update member role:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to update member role' } })
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
