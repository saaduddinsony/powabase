import { components } from 'api-types'

import { assertSelfHosted } from './util'
import { getSocketProjectByRef } from './metadata'
import { PROJECT_ENDPOINT, PROJECT_ENDPOINT_PROTOCOL } from '@/lib/constants/api'

type ProjectAppConfig = components['schemas']['ProjectSettingsResponse']['app_config'] & {
  protocol?: string
}

export type ProjectSettings = components['schemas']['ProjectSettingsResponse'] & {
  app_config?: ProjectAppConfig
}

/**
 * Gets self-hosted project settings (synchronous fallback for default project)
 *
 * _Only call this from server-side self-hosted code._
 */
export function getProjectSettings(): ProjectSettings {
  assertSelfHosted()

  return {
    app_config: {
      db_schema: 'public',
      endpoint: PROJECT_ENDPOINT,
      storage_endpoint: PROJECT_ENDPOINT,
      protocol: PROJECT_ENDPOINT_PROTOCOL,
    },
    cloud_provider: 'localhost',
    db_dns_name: '-',
    db_host: 'localhost',
    db_ip_addr_config: 'legacy' as const,
    db_name: 'postgres',
    db_port: 5432,
    db_user: 'postgres',
    inserted_at: '2021-08-02T06:40:40.646Z',
    jwt_secret:
      process.env.AUTH_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long',
    name: process.env.DEFAULT_PROJECT_NAME || 'Default Project',
    ref: 'default',
    region: 'local',
    service_api_keys: [
      {
        api_key: process.env.SUPABASE_SERVICE_KEY ?? '',
        name: 'service_role key',
        tags: 'service_role',
      },
      {
        api_key: process.env.SUPABASE_ANON_KEY ?? '',
        name: 'anon key',
        tags: 'anon',
      },
    ],
    ssl_enforced: false,
    status: 'ACTIVE_HEALTHY',
  } satisfies ProjectSettings
}

/**
 * Gets dynamic self-hosted project settings with scoped schema and keys for a specific project ref.
 */
export async function getProjectSettingsForRef(ref?: string): Promise<ProjectSettings> {
  assertSelfHosted()
  const projectRef = ref || 'default'

  try {
    const project = await getSocketProjectByRef(projectRef)
    if (project) {
      const dbSchema = project.db_schema || (project.ref === 'default' ? 'public' : `project_${project.ref.replace(/[^a-zA-Z0-9_]/g, '_')}`)
      const serviceKey = project.service_role_key || process.env.SUPABASE_SERVICE_KEY || ''
      const anonKey = project.anon_key || process.env.SUPABASE_ANON_KEY || ''

      return {
        app_config: {
          db_schema: dbSchema,
          endpoint: PROJECT_ENDPOINT,
          storage_endpoint: PROJECT_ENDPOINT,
          protocol: PROJECT_ENDPOINT_PROTOCOL,
        },
        cloud_provider: project.cloud_provider || 'localhost',
        db_dns_name: '-',
        db_host: 'localhost',
        db_ip_addr_config: 'legacy' as const,
        db_name: 'postgres',
        db_port: 5432,
        db_user: 'postgres',
        inserted_at: project.inserted_at || new Date().toISOString(),
        jwt_secret: project.jwt_secret || process.env.AUTH_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long',
        name: project.name || 'Project',
        ref: project.ref,
        region: project.region || 'local',
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
        ssl_enforced: false,
        status: project.status || 'ACTIVE_HEALTHY',
      } satisfies ProjectSettings
    }
  } catch (err) {
    console.warn(`Could not load socket project settings for ref ${projectRef}, falling back:`, err)
  }

  return getProjectSettings()
}
