import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  createSocketProject,
  getSocketProjects,
} from '@/lib/api/self-hosted/metadata'
import { PROJECT_REST_URL } from '@/lib/constants/api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'POST':
      return handleCreate(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const rawProjects = await getSocketProjects()
    const projects = rawProjects.map((p) => ({
      id: p.id,
      ref: p.ref,
      name: p.name,
      organization_id: p.organization_id,
      cloud_provider: p.cloud_provider || 'localhost',
      status: p.status || 'ACTIVE_HEALTHY',
      region: p.region || 'local',
      inserted_at: p.inserted_at || new Date().toISOString(),
      is_branch: false,
      databases: [],
      connectionString: '',
      restUrl: PROJECT_REST_URL,
    }))

    // If caller requests Version 2 or includes limit, return paginated envelope
    const isVersion2 = req.headers.version === '2' || req.query.limit !== undefined
    if (isVersion2) {
      return res.status(200).json({
        pagination: {
          count: projects.length,
          limit: Number(req.query.limit) || 100,
          offset: Number(req.query.offset) || 0,
        },
        projects,
      })
    }

    return res.status(200).json(projects)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to list projects' } })
  }
}

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name, organization_slug, organizationSlug } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: { message: 'Project name is required' } })
  }

  try {
    const project = await createSocketProject({
      name: name.trim(),
      organizationSlug: organization_slug || organizationSlug,
    })

    return res.status(201).json({
      ...project,
      connectionString: '',
      restUrl: PROJECT_REST_URL,
    })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to create project' } })
  }
}
