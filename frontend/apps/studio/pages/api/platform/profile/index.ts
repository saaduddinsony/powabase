import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { DEFAULT_PROJECT } from '@/lib/constants/api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  const response = {
    id: 1,
    primary_email: 'admin@socket.dev',
    username: 'admin',
    first_name: 'Socket',
    last_name: 'Admin',
    gotrue_id: '00000000-0000-0000-0000-000000000001',
    organizations: [
      {
        id: 1,
        name: process.env.DEFAULT_ORGANIZATION_NAME || 'Socket Organization',
        slug: 'default-org-slug',
        billing_email: 'admin@socket.dev',
        projects: [{ ...DEFAULT_PROJECT, connectionString: '' }],
      },
    ],
  }
  return res.status(200).json(response)
}
