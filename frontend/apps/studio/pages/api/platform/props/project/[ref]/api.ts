import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjectByRef } from '@/lib/api/self-hosted/metadata'
import {
  DEFAULT_PROJECT,
  PROJECT_ENDPOINT,
  PROJECT_ENDPOINT_PROTOCOL,
  PROJECT_REST_URL,
} from '@/lib/constants/api'

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
  const { ref } = req.query
  const projectRef = (typeof ref === 'string' ? ref : ref?.[0]) || 'default'

  let dbSchema = 'public'
  let anonKey = process.env.SUPABASE_ANON_KEY || ''
  let serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || ''
  let projectName = DEFAULT_PROJECT.name
  let projectId = 1

  try {
    const project = await getSocketProjectByRef(projectRef)
    if (project) {
      projectId = project.id
      projectName = project.name
      dbSchema = project.db_schema || (project.ref === 'default' ? 'public' : `project_${project.ref.replace(/[^a-zA-Z0-9_]/g, '_')}`)
      if (project.anon_key) anonKey = project.anon_key
      if (project.service_role_key) serviceRoleKey = project.service_role_key
    }
  } catch (err) {
    console.warn(`Failed to load project details for API props (${projectRef}):`, err)
  }

  const response = {
    project: {
      ...DEFAULT_PROJECT,
      id: projectId,
      ref: projectRef,
      name: projectName,
      api_key_supabase_encrypted: '',
      db_host: 'localhost',
      db_name: 'postgres',
      db_port: 5432,
      db_ssl: false,
      db_user: 'postgres',
      services: [
        {
          id: projectId,
          name: `${projectName} API`,
          app: { id: 1, name: 'Auto API' },
          app_config: {
            db_schema: dbSchema,
            endpoint: PROJECT_ENDPOINT,
            realtime_enabled: true,
          },
          service_api_keys: [
            {
              api_key_encrypted: '-',
              name: 'service_role key',
              tags: 'service_role',
            },
            {
              api_key_encrypted: '-',
              name: 'anon key',
              tags: 'anon',
            },
          ],
        },
      ],
    },
    autoApiService: {
      id: projectId,
      name: `${projectName} API`,
      project: { ref: projectRef },
      app: { id: 1, name: 'Auto API' },
      app_config: {
        db_schema: dbSchema,
        endpoint: PROJECT_ENDPOINT,
        realtime_enabled: true,
      },
      protocol: PROJECT_ENDPOINT_PROTOCOL,
      endpoint: PROJECT_ENDPOINT,
      restUrl: PROJECT_REST_URL,
      defaultApiKey: anonKey,
      serviceApiKey: serviceRoleKey,
      service_api_keys: [
        {
          api_key_encrypted: '-',
          name: 'service_role key',
          tags: 'service_role',
        },
        {
          api_key_encrypted: '-',
          name: 'anon key',
          tags: 'anon',
        },
      ],
    },
  }

  return res.status(200).json(response)
}
