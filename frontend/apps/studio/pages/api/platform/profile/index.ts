import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { DEFAULT_PROJECT } from '@/lib/constants/api'
import {
  getSocketUserProfile,
  updateSocketUserProfile,
  getSocketOrganizations,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const profile = await getSocketUserProfile()
    const orgs = await getSocketOrganizations()

    const response = {
      id: profile.id,
      primary_email: profile.primary_email,
      username: profile.username,
      first_name: profile.first_name,
      last_name: profile.last_name,
      gotrue_id: profile.gotrue_id,
      organizations: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        billing_email: org.billing_email,
        projects: [{ ...DEFAULT_PROJECT, connectionString: '' }],
      })),
    }

    return res.status(200).json(response)
  } catch (error: any) {
    console.error('Failed to get profile:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to get profile' } })
  }
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { first_name, last_name, username, primary_email } = req.body || {}
    const updated = await updateSocketUserProfile({
      first_name,
      last_name,
      username,
      primary_email,
    })

    return res.status(200).json(updated)
  } catch (error: any) {
    console.error('Failed to update profile:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to update profile' } })
  }
}
