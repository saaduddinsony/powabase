import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  // Return permissions granting full team and resource management
  return res.status(200).json([
    { action: '*', subject: '*', organization_id: 1 },
    { action: 'create', subject: 'user_invites', organization_id: 1 },
    { action: 'delete', subject: 'user_invites', organization_id: 1 },
    { action: 'create', subject: 'auth.subject_roles', organization_id: 1 },
    { action: 'delete', subject: 'auth.subject_roles', organization_id: 1 },
    { action: 'update', subject: 'auth.subject_roles', organization_id: 1 },
    { action: 'delete', subject: 'organization_members', organization_id: 1 },
  ])
}
