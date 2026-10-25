import { components } from 'api-types'
import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjectByRef } from '@/lib/api/self-hosted/metadata'

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
  const projectRef = (typeof ref === 'string' ? ref : ref?.[0]) || 'default'

  let projectSchema = 'public'
  let jwtSecret = process.env.AUTH_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'

  try {
    const project = await getSocketProjectByRef(projectRef)
    if (project) {
      projectSchema = project.db_schema || (project.ref === 'default' ? 'public' : `project_${project.ref.replace(/[^a-zA-Z0-9_]/g, '_')}`)
      if (project.jwt_secret) jwtSecret = project.jwt_secret
    }
  } catch (err) {
    console.warn(`Could not load postgrest config for project ${projectRef}:`, err)
  }

  const baseSchemas = (process.env.PGRST_DB_SCHEMAS ?? 'public,storage,graphql_public')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const exposedSchemas = Array.from(new Set([projectSchema, ...baseSchemas])).join(', ')

  const responseObj: components['schemas']['GetPostgrestConfigResponse'] = {
    db_anon_role: 'anon',
    db_extra_search_path: `${projectSchema}, public`,
    db_schema: exposedSchemas,
    jwt_secret: jwtSecret,
    max_rows: Number(process.env.PGRST_DB_MAX_ROWS) || 1000,
    role_claim_key: '.role',
  }

  return res.status(200).json(responseObj)
}
