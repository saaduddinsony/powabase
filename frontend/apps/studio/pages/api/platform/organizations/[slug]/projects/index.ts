import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjects } from '@/lib/api/self-hosted/metadata'

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
  const slug = req.query.slug as string

  try {
    const rawProjects = await getSocketProjects(slug)
    const projects = rawProjects.map((p) => ({
      id: p.id,
      ref: p.ref,
      name: p.name,
      cloud_provider: p.cloud_provider || 'localhost',
      status: p.status || 'ACTIVE_HEALTHY',
      region: p.region || 'local',
      inserted_at: p.inserted_at || new Date().toISOString(),
      is_branch: false,
      databases: [],
    }))

    return res.status(200).json({
      pagination: {
        count: projects.length,
        limit: 100,
        offset: 0,
      },
      projects,
    })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to list projects' } })
  }
}
