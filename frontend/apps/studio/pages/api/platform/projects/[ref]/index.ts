import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  deleteSocketProject,
  getSocketProjectByRef,
  updateSocketProject,
} from '@/lib/api/self-hosted/metadata'
import { DEFAULT_PROJECT, PROJECT_REST_URL } from '@/lib/constants/api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const ref = req.query.ref as string

  try {
    const project = await getSocketProjectByRef(ref)
    if (!project) {
      return res.status(404).json({ error: { message: 'Project not found' } })
    }

    const dbHost = process.env.POSTGRES_PUBLIC_HOST || process.env.POSTGRES_HOST || 'localhost'
    const dbPort = process.env.POSTGRES_PORT || '5432'
    const dbUser = process.env.POSTGRES_USER || 'postgres'
    const dbPassword = process.env.POSTGRES_PASSWORD || ''
    const dbName = process.env.POSTGRES_DB || 'postgres'
    const connectionString = dbPassword
      ? `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`
      : `postgresql://${dbUser}:[YOUR-PASSWORD]@${dbHost}:${dbPort}/${dbName}`

    const anonKey = project.anon_key || process.env.SUPABASE_ANON_KEY || ''
    const serviceKey = project.service_role_key || process.env.SUPABASE_SERVICE_KEY || ''

    const response = {
      ...DEFAULT_PROJECT,
      ...project,
      connectionString,
      restUrl: PROJECT_REST_URL,
      service_api_keys: [
        {
          api_key: serviceKey,
          name: 'service_role key',
          tags: 'service_role',
        },
        {
          api_key: anonKey,
          name: 'anon key',
          tags: 'anon',
        },
      ],
    }

    return res.status(200).json(response)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to get project' } })
  }
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const ref = req.query.ref as string
  const { name } = req.body || {}

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: { message: 'Project name is required' } })
  }

  try {
    const updated = await updateSocketProject(ref, { name })
    return res.status(200).json({
      ...DEFAULT_PROJECT,
      ...updated,
      connectionString: '',
      restUrl: PROJECT_REST_URL,
    })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to update project' } })
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const ref = req.query.ref as string

  if (ref === 'default') {
    return res.status(400).json({ error: { message: 'Cannot delete the default project' } })
  }

  try {
    await deleteSocketProject(ref)
    return res.status(200).json({ success: true })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to delete project' } })
  }
}
