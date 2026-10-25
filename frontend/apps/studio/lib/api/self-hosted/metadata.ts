import { executeQuery } from './query'

export interface SocketOrganization {
  id: number
  name: string
  slug: string
  billing_email: string
  plan: {
    id: string
    name: string
  }
}

export interface SocketProject {
  id: number
  ref: string
  name: string
  organization_id: number
  cloud_provider: string
  status: string
  region: string
  inserted_at: string
}

let isInitialized = false

/**
 * Initializes the _socket_metadata schema and seed tables in PostgreSQL.
 */
export async function ensureMetadataSchema(): Promise<void> {
  if (isInitialized) return

  const initSql = `
    CREATE SCHEMA IF NOT EXISTS _socket_metadata;

    CREATE TABLE IF NOT EXISTS _socket_metadata.organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      billing_email TEXT DEFAULT 'admin@socket.dev',
      plan_id TEXT DEFAULT 'enterprise',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.projects (
      id SERIAL PRIMARY KEY,
      ref TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      organization_id INTEGER REFERENCES _socket_metadata.organizations(id) ON DELETE CASCADE,
      cloud_provider TEXT DEFAULT 'localhost',
      status TEXT DEFAULT 'ACTIVE_HEALTHY',
      region TEXT DEFAULT 'local',
      inserted_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO _socket_metadata.organizations (id, name, slug, billing_email, plan_id)
    VALUES (1, 'Socket Organization', 'default-org-slug', 'admin@socket.dev', 'enterprise')
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO _socket_metadata.projects (id, ref, name, organization_id, cloud_provider, status, region)
    VALUES (1, 'default', 'Default Project', 1, 'localhost', 'ACTIVE_HEALTHY', 'local')
    ON CONFLICT (ref) DO NOTHING;

    SELECT setval(pg_get_serial_sequence('_socket_metadata.organizations', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.organizations;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.projects', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.projects;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA _socket_metadata TO postgres, authenticated, service_role, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA _socket_metadata TO postgres, authenticated, service_role, anon;
  `

  try {
    await executeQuery({ query: initSql })
    isInitialized = true
  } catch (err) {
    console.error('Failed to initialize _socket_metadata schema:', err)
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateRandomRef(name: string): string {
  const base = slugify(name) || 'project'
  const rand = Math.random().toString(36).substring(2, 8)
  return `${base}-${rand}`
}

export async function getSocketOrganizations(): Promise<SocketOrganization[]> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<{
    id: number
    name: string
    slug: string
    billing_email: string
    plan_id: string
  }>({
    query: `SELECT id, name, slug, billing_email, plan_id FROM _socket_metadata.organizations ORDER BY id ASC`,
  })

  if (error || !data || data.length === 0) {
    return [
      {
        id: 1,
        name: process.env.DEFAULT_ORGANIZATION_NAME || 'Socket Organization',
        slug: 'default-org-slug',
        billing_email: 'admin@socket.dev',
        plan: { id: 'enterprise', name: 'Enterprise' },
      },
    ]
  }

  return data.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    billing_email: org.billing_email || 'admin@socket.dev',
    plan: {
      id: org.plan_id || 'enterprise',
      name: 'Enterprise',
    },
  }))
}

export async function createSocketOrganization(name: string): Promise<SocketOrganization> {
  await ensureMetadataSchema()

  const trimmedName = name.trim()
  const baseSlug = slugify(trimmedName) || 'org'
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`

  const { data, error } = await executeQuery<{
    id: number
    name: string
    slug: string
    billing_email: string
    plan_id: string
  }>({
    query: `
      INSERT INTO _socket_metadata.organizations (name, slug, billing_email, plan_id)
      VALUES ($1, $2, 'admin@socket.dev', 'enterprise')
      RETURNING id, name, slug, billing_email, plan_id
    `,
    parameters: [trimmedName, uniqueSlug],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to create organization')
  }

  const row = data[0]
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    billing_email: row.billing_email,
    plan: { id: row.plan_id || 'enterprise', name: 'Enterprise' },
  }
}

export async function getSocketProjects(orgSlug?: string): Promise<SocketProject[]> {
  await ensureMetadataSchema()

  let sql = `
    SELECT p.id, p.ref, p.name, p.organization_id, p.cloud_provider, p.status, p.region, p.inserted_at
    FROM _socket_metadata.projects p
  `
  const params: unknown[] = []

  if (orgSlug) {
    sql += `
      JOIN _socket_metadata.organizations o ON p.organization_id = o.id
      WHERE o.slug = $1
    `
    params.push(orgSlug)
  }

  sql += ` ORDER BY p.id ASC`

  const { data, error } = await executeQuery<SocketProject>({
    query: sql,
    parameters: params.length > 0 ? params : undefined,
  })

  if (error || !data || data.length === 0) {
    return [
      {
        id: 1,
        ref: 'default',
        name: process.env.DEFAULT_PROJECT_NAME || 'Default Project',
        organization_id: 1,
        cloud_provider: 'localhost',
        status: 'ACTIVE_HEALTHY',
        region: 'local',
        inserted_at: new Date().toISOString(),
      },
    ]
  }

  return data
}

export async function getSocketProjectByRef(ref: string): Promise<SocketProject | null> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketProject>({
    query: `SELECT id, ref, name, organization_id, cloud_provider, status, region, inserted_at FROM _socket_metadata.projects WHERE ref = $1`,
    parameters: [ref],
  })

  if (error || !data || data.length === 0) {
    if (ref === 'default') {
      return {
        id: 1,
        ref: 'default',
        name: process.env.DEFAULT_PROJECT_NAME || 'Default Project',
        organization_id: 1,
        cloud_provider: 'localhost',
        status: 'ACTIVE_HEALTHY',
        region: 'local',
        inserted_at: new Date().toISOString(),
      }
    }
    return null
  }

  return data[0]
}

export async function createSocketProject({
  name,
  organizationSlug,
}: {
  name: string
  organizationSlug?: string
}): Promise<SocketProject> {
  await ensureMetadataSchema()

  const trimmedName = name.trim()
  const ref = generateRandomRef(trimmedName)

  // Find organization ID
  let orgId = 1
  if (organizationSlug) {
    const { data: orgData } = await executeQuery<{ id: number }>({
      query: `SELECT id FROM _socket_metadata.organizations WHERE slug = $1`,
      parameters: [organizationSlug],
    })
    if (orgData && orgData.length > 0) {
      orgId = orgData[0].id
    }
  }

  const { data, error } = await executeQuery<SocketProject>({
    query: `
      INSERT INTO _socket_metadata.projects (ref, name, organization_id, cloud_provider, status, region)
      VALUES ($1, $2, $3, 'localhost', 'ACTIVE_HEALTHY', 'local')
      RETURNING id, ref, name, organization_id, cloud_provider, status, region, inserted_at
    `,
    parameters: [ref, trimmedName, orgId],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to create project')
  }

  return data[0]
}

export async function updateSocketProject(ref: string, { name }: { name: string }): Promise<SocketProject> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketProject>({
    query: `
      UPDATE _socket_metadata.projects
      SET name = $1
      WHERE ref = $2
      RETURNING id, ref, name, organization_id, cloud_provider, status, region, inserted_at
    `,
    parameters: [name.trim(), ref],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to update project')
  }

  return data[0]
}

export async function deleteSocketProject(ref: string): Promise<boolean> {
  await ensureMetadataSchema()

  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.projects WHERE ref = $1`,
    parameters: [ref],
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete project')
  }

  return true
}
