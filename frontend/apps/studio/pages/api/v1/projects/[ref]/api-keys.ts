import { components } from 'api-types'
import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketProjectByRef } from '@/lib/api/self-hosted/metadata'

type ProjectAppConfig = components['schemas']['ProjectSettingsResponse']['app_config'] & {
  protocol?: string
}
export type ProjectSettings = components['schemas']['ProjectSettingsResponse'] & {
  app_config?: ProjectAppConfig
}

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
  const projectRef = typeof ref === 'string' ? ref : ref?.[0]

  let anonKey = process.env.SUPABASE_ANON_KEY ?? ''
  let serviceKey = process.env.SUPABASE_SERVICE_KEY ?? ''

  if (projectRef && projectRef !== 'default') {
    try {
      const project = await getSocketProjectByRef(projectRef)
      if (project) {
        if (project.anon_key) anonKey = project.anon_key
        if (project.service_role_key) serviceKey = project.service_role_key
      }
    } catch {
      // fallback to default env keys
    }
  }

  const response = [
    {
      name: 'anon',
      api_key: anonKey,
      id: 'anon',
      type: 'publishable',
      hash: '',
      prefix: '',
      description: 'Publishable API key (anon)',
    },
    {
      name: 'service_role',
      api_key: serviceKey,
      id: 'service_role',
      type: 'secret',
      hash: '',
      prefix: '',
      description: 'Secret API key (service_role)',
    },
  ]

  return res.status(200).json(response)
}
