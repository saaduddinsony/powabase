import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  acceptSocketInvitation,
  deleteSocketOrganizationInvitation,
  getSocketInvitationByToken,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug, id } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: { message: 'Organization slug is required' } })
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Invitation identifier or token is required' } })
  }

  // DELETE: Delete invitation by numeric ID or token
  if (req.method === 'DELETE') {
    try {
      const numericId = parseInt(id, 10)
      if (isNaN(numericId)) {
        return res.status(400).json({ error: { message: 'Invalid invitation ID' } })
      }
      await deleteSocketOrganizationInvitation(numericId)
      return res.status(200).json({ success: true })
    } catch (error: any) {
      console.error('Failed to delete invitation:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to delete invitation' } })
    }
  }

  // GET: Fetch invitation details by token
  if (req.method === 'GET') {
    try {
      const inviteData = await getSocketInvitationByToken(id)
      return res.status(200).json(inviteData)
    } catch (error: any) {
      console.error('Failed to fetch invitation by token:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to get invitation' } })
    }
  }

  // POST: Accept invitation by token
  if (req.method === 'POST') {
    try {
      const { user_email, user_id } = req.body || {}
      const result = await acceptSocketInvitation(id, user_email, user_id)
      return res.status(200).json(result)
    } catch (error: any) {
      console.error('Failed to accept invitation:', error)
      return res.status(500).json({ error: { message: error.message || 'Failed to accept invitation' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
