import crypto from 'crypto'
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
  db_schema?: string
  jwt_secret?: string
  anon_key?: string
  service_role_key?: string
}

let isInitialized = false

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Signs a standard HS256 JWT using pure Node.js crypto.
 * Compatible with PostgREST, GoTrue, Kong, and Supabase client SDKs.
 */
export function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest()
  return `${dataToSign}.${base64url(signature)}`
}

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
      db_schema TEXT DEFAULT 'public',
      jwt_secret TEXT,
      anon_key TEXT,
      service_role_key TEXT,
      inserted_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE _socket_metadata.projects ADD COLUMN IF NOT EXISTS db_schema TEXT DEFAULT 'public';
    ALTER TABLE _socket_metadata.projects ADD COLUMN IF NOT EXISTS jwt_secret TEXT;
    ALTER TABLE _socket_metadata.projects ADD COLUMN IF NOT EXISTS anon_key TEXT;
    ALTER TABLE _socket_metadata.projects ADD COLUMN IF NOT EXISTS service_role_key TEXT;

    INSERT INTO _socket_metadata.organizations (id, name, slug, billing_email, plan_id)
    VALUES (1, 'Socket Organization', 'default-org-slug', 'admin@socket.dev', 'enterprise')
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO _socket_metadata.projects (
      id, ref, name, organization_id, cloud_provider, status, region, db_schema
    )
    VALUES (1, 'default', 'Default Project', 1, 'localhost', 'ACTIVE_HEALTHY', 'local', 'public')
    ON CONFLICT (ref) DO NOTHING;

    UPDATE _socket_metadata.projects
    SET db_schema = 'public'
    WHERE ref = 'default' AND (db_schema IS NULL OR db_schema = '');

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
        name: 'Socket Organization',
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
    plan: { id: org.plan_id || 'enterprise', name: 'Enterprise' },
  }))
}

export async function createSocketOrganization({ name }: { name: string }): Promise<SocketOrganization> {
  await ensureMetadataSchema()

  const trimmedName = name.trim()
  const slug = `${slugify(trimmedName)}-${Math.random().toString(36).substring(2, 6)}`

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
    parameters: [trimmedName, slug],
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
    SELECT p.id, p.ref, p.name, p.organization_id, p.cloud_provider, p.status, p.region, p.inserted_at,
           p.db_schema, p.jwt_secret, p.anon_key, p.service_role_key
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
        db_schema: 'public',
        anon_key: process.env.SUPABASE_ANON_KEY,
        service_role_key: process.env.SUPABASE_SERVICE_KEY,
        inserted_at: new Date().toISOString(),
      },
    ]
  }

  return data
}

export async function getSocketProjectByRef(ref: string): Promise<SocketProject | null> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketProject>({
    query: `
      SELECT id, ref, name, organization_id, cloud_provider, status, region, inserted_at,
             db_schema, jwt_secret, anon_key, service_role_key
      FROM _socket_metadata.projects
      WHERE ref = $1
    `,
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
        db_schema: 'public',
        anon_key: process.env.SUPABASE_ANON_KEY,
        service_role_key: process.env.SUPABASE_SERVICE_KEY,
        jwt_secret: process.env.AUTH_JWT_SECRET,
        inserted_at: new Date().toISOString(),
      }
    }
    return null
  }

  const project = data[0]
  if (!project.jwt_secret || !project.anon_key || !project.service_role_key) {
    const jwtSecret = project.jwt_secret || crypto.randomBytes(32).toString('hex')
    const now = Math.floor(Date.now() / 1000)
    const tenYears = 10 * 365 * 24 * 60 * 60
    const anonKey =
      project.anon_key ||
      signHs256Jwt(
        { role: 'anon', iss: 'supabase', iat: now, exp: now + tenYears },
        jwtSecret
      )
    const serviceRoleKey =
      project.service_role_key ||
      signHs256Jwt(
        { role: 'service_role', iss: 'supabase', iat: now, exp: now + tenYears },
        jwtSecret
      )
    const dbSchema =
      project.db_schema ||
      (project.ref === 'default'
        ? 'public'
        : `project_${project.ref.replace(/[^a-zA-Z0-9_]/g, '_')}`)

    await executeQuery({
      query: `
        UPDATE _socket_metadata.projects
        SET jwt_secret = $1, anon_key = $2, service_role_key = $3, db_schema = $4
        WHERE id = $5
      `,
      parameters: [jwtSecret, anonKey, serviceRoleKey, dbSchema, project.id],
    })

    project.jwt_secret = jwtSecret
    project.anon_key = anonKey
    project.service_role_key = serviceRoleKey
    project.db_schema = dbSchema
  }

  return project
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

  // 1. Generate Schema Name and Cryptographic Keys
  const safeRef = ref.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const dbSchema = `project_${safeRef}`
  const projectJwtSecret = crypto.randomBytes(32).toString('hex')
  const nowSec = Math.floor(Date.now() / 1000)
  const expSec = nowSec + 60 * 60 * 24 * 365 * 10 // 10 years

  const anonKey = signHs256Jwt(
    {
      role: 'anon',
      iss: 'socket',
      project_ref: ref,
      db_schema: dbSchema,
      iat: nowSec,
      exp: expSec,
    },
    projectJwtSecret
  )

  const serviceRoleKey = signHs256Jwt(
    {
      role: 'service_role',
      iss: 'socket',
      project_ref: ref,
      db_schema: dbSchema,
      iat: nowSec,
      exp: expSec,
    },
    projectJwtSecret
  )

  // 2. Provision dedicated isolated PostgreSQL schema and assign permissions
  const provisionSchemaSql = `
    CREATE SCHEMA IF NOT EXISTS "${dbSchema}";
    GRANT USAGE, CREATE ON SCHEMA "${dbSchema}" TO postgres, authenticated, service_role, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON TABLES TO postgres, authenticated, service_role, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON SEQUENCES TO postgres, authenticated, service_role, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON ROUTINES TO postgres, authenticated, service_role, anon;
    NOTIFY pgrst, 'reload schema';
  `
  try {
    await executeQuery({ query: provisionSchemaSql })
  } catch (schemaErr) {
    console.error(`Failed to provision PostgreSQL schema ${dbSchema}:`, schemaErr)
  }

  // 3. Save project metadata with schema and scoped credentials
  const { data, error } = await executeQuery<SocketProject>({
    query: `
      INSERT INTO _socket_metadata.projects (
        ref, name, organization_id, cloud_provider, status, region,
        db_schema, jwt_secret, anon_key, service_role_key
      )
      VALUES ($1, $2, $3, 'localhost', 'ACTIVE_HEALTHY', 'local', $4, $5, $6, $7)
      RETURNING id, ref, name, organization_id, cloud_provider, status, region, inserted_at,
                db_schema, jwt_secret, anon_key, service_role_key
    `,
    parameters: [ref, trimmedName, orgId, dbSchema, projectJwtSecret, anonKey, serviceRoleKey],
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
      RETURNING id, ref, name, organization_id, cloud_provider, status, region, inserted_at,
                db_schema, jwt_secret, anon_key, service_role_key
    `,
    parameters: [name.trim(), ref],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to update project')
  }

  return data[0]
}

export async function deleteSocketProject(ref: string): Promise<boolean> {
  if (ref === 'default') {
    throw new Error('The default project cannot be deleted.')
  }
  await ensureMetadataSchema()

  // Fetch project to drop its isolated schema safely
  const project = await getSocketProjectByRef(ref)
  if (project?.db_schema && project.db_schema !== 'public') {
    const safeSchema = project.db_schema.replace(/[^a-zA-Z0-9_]/g, '')
    if (safeSchema.startsWith('project_')) {
      try {
        await executeQuery({ query: `DROP SCHEMA IF EXISTS "${safeSchema}" CASCADE; NOTIFY pgrst, 'reload schema';` })
      } catch (dropErr) {
        console.warn(`Could not drop isolated schema ${safeSchema}:`, dropErr)
      }
    }
  }

  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.projects WHERE ref = $1`,
    parameters: [ref],
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete project')
  }

  return true
}
