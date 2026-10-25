import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjectByRef } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
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
    console.warn(`Could not load general config for project ${projectRef}:`, err)
  }

  const allSchemas = Array.from(new Set([projectSchema, 'public', 'storage'])).join(', ')

  return res.status(200).json({
    db_anon_role: 'anon',
    db_extra_search_path: `${projectSchema}, public`,
    db_schema: allSchemas,
    jwt_secret: jwtSecret,
    max_rows: 100,
    role_claim_key: '.role',
  })
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  return res.status(200).json({})
}
