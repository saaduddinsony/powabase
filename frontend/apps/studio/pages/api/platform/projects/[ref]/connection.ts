import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjectByRef } from '@/lib/api/self-hosted/metadata'
import { PROJECT_ENDPOINT, PROJECT_ENDPOINT_PROTOCOL } from '@/lib/constants/api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const { ref } = req.query
  const projectRef = typeof ref === 'string' ? ref : ref?.[0]

  if (!projectRef) {
    return res.status(400).json({ error: { message: 'Project ref is required' } })
  }

  try {
    const project = await getSocketProjectByRef(projectRef)
    if (!project) {
      return res.status(404).json({ error: { message: 'Project not found' } })
    }

    const kongUrl =
      process.env.SUPABASE_PUBLIC_URL ||
      process.env.API_EXTERNAL_URL ||
      `${PROJECT_ENDPOINT_PROTOCOL}://${PROJECT_ENDPOINT}`

    const anonKey = project.anon_key || process.env.SUPABASE_ANON_KEY || ''
    const serviceRoleKey = project.service_role_key || process.env.SUPABASE_SERVICE_KEY || ''
    const jwtSecret = project.jwt_secret || process.env.AUTH_JWT_SECRET || ''

    const dbHost = process.env.POSTGRES_PUBLIC_HOST || process.env.POSTGRES_HOST || 'localhost'
    const dbPort = process.env.POSTGRES_PORT || '5432'
    const dbUser = process.env.POSTGRES_USER || 'postgres'
    const dbPassword = process.env.POSTGRES_PASSWORD || ''
    const dbName = process.env.POSTGRES_DB || 'postgres'

    const postgresUrl = dbPassword
      ? `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`
      : `postgresql://${dbUser}:[YOUR-PASSWORD]@${dbHost}:${dbPort}/${dbName}`

    return res.status(200).json({
      kong_url: kongUrl,
      anon_key: anonKey,
      service_role_key: serviceRoleKey,
      jwt_secret: jwtSecret,
      postgres_url: postgresUrl,
    })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to get connection info' } })
  }
}
