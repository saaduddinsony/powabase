import crypto from 'crypto'
import { executeQuery } from './query'
export { executeQuery } from './query'

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

export interface SocketMember {
  id: number
  organization_id: number
  primary_email: string
  username: string
  role_id: number
  project_scoped_roles: string[]
  mfa_enabled: boolean
  gotrue_id: string
  created_at: string
}

export interface SocketInvitation {
  id: number
  organization_id: number
  invited_email: string
  role_id: number
  role_scoped_projects: string[]
  token: string
  invited_at: string
  expires_at: string
  status: string
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

    CREATE TABLE IF NOT EXISTS _socket_metadata.organization_members (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES _socket_metadata.organizations(id) ON DELETE CASCADE,
      primary_email TEXT NOT NULL,
      username TEXT,
      role_id INTEGER DEFAULT 1,
      project_scoped_roles JSONB DEFAULT '[]'::jsonb,
      mfa_enabled BOOLEAN DEFAULT FALSE,
      gotrue_id TEXT DEFAULT '00000000-0000-0000-0000-000000000001',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, primary_email)
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.organization_invitations (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES _socket_metadata.organizations(id) ON DELETE CASCADE,
      invited_email TEXT NOT NULL,
      role_id INTEGER DEFAULT 3,
      role_scoped_projects JSONB DEFAULT '[]'::jsonb,
      token TEXT UNIQUE NOT NULL,
      invited_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.project_auth_config (
      project_ref TEXT PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

    INSERT INTO _socket_metadata.organization_members (
      organization_id, primary_email, username, role_id, mfa_enabled, gotrue_id
    )
    SELECT 1, 'admin@socket.dev', 'admin', 1, false, '00000000-0000-0000-0000-000000000001'
    WHERE NOT EXISTS (
      SELECT 1 FROM _socket_metadata.organization_members WHERE organization_id = 1
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.user_profiles (
      id SERIAL PRIMARY KEY,
      gotrue_id TEXT UNIQUE NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
      primary_email TEXT NOT NULL DEFAULT 'admin@socket.dev',
      username TEXT DEFAULT 'admin',
      first_name TEXT DEFAULT 'Socket',
      last_name TEXT DEFAULT 'Admin',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.personal_access_tokens (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      token_alias TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scope TEXT DEFAULT 'all',
      expires_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id TEXT DEFAULT '00000000-0000-0000-0000-000000000001'
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.copilot_sessions (
      id TEXT PRIMARY KEY,
      project_ref TEXT NOT NULL DEFAULT 'default',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.copilot_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES _socket_metadata.copilot_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      guide_event JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.copilot_settings (
      project_ref TEXT PRIMARY KEY,
      warn_on_delete BOOLEAN DEFAULT TRUE,
      model TEXT DEFAULT 'auto',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO _socket_metadata.copilot_settings (project_ref, warn_on_delete)
    VALUES ('default', TRUE)
    ON CONFLICT (project_ref) DO NOTHING;

    INSERT INTO _socket_metadata.user_profiles (gotrue_id, primary_email, username, first_name, last_name)
    VALUES ('00000000-0000-0000-0000-000000000001', 'admin@socket.dev', 'admin', 'Socket', 'Admin')
    ON CONFLICT (gotrue_id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS _socket_metadata.branches (
      id TEXT PRIMARY KEY,
      project_ref TEXT NOT NULL,
      name TEXT NOT NULL,
      git_branch TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'ACTIVE_HEALTHY',
      preview_project_status TEXT DEFAULT 'ACTIVE_HEALTHY',
      db_schema TEXT DEFAULT 'public',
      persistent BOOLEAN DEFAULT TRUE,
      with_data BOOLEAN DEFAULT TRUE,
      subdomain TEXT,
      custom_domain TEXT,
      ssl_status TEXT DEFAULT 'active',
      api_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(project_ref, name)
    );

    ALTER TABLE _socket_metadata.branches ADD COLUMN IF NOT EXISTS subdomain TEXT;
    ALTER TABLE _socket_metadata.branches ADD COLUMN IF NOT EXISTS custom_domain TEXT;
    ALTER TABLE _socket_metadata.branches ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'active';
    ALTER TABLE _socket_metadata.branches ADD COLUMN IF NOT EXISTS api_url TEXT;

    INSERT INTO _socket_metadata.branches (
      id, project_ref, name, git_branch, is_default, status, preview_project_status, db_schema
    )
    VALUES (
      'main', 'default', 'main', 'main', TRUE, 'MIGRATIONS_PASSED', 'ACTIVE_HEALTHY', 'public'
    )
    ON CONFLICT (project_ref, name) DO NOTHING;

    CREATE TABLE IF NOT EXISTS _socket_metadata.remote_storage_gateways (
      id SERIAL PRIMARY KEY,
      project_ref TEXT NOT NULL,
      name TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      region TEXT DEFAULT 'us-east-1',
      access_key TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.remote_mysql_servers (
      id SERIAL PRIMARY KEY,
      project_ref TEXT NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 3306,
      database_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      foreign_schema TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      auto_sync_enabled BOOLEAN DEFAULT FALSE,
      sync_interval_mins INTEGER DEFAULT 60,
      last_synced_at TIMESTAMPTZ,
      sync_status TEXT DEFAULT 'idle',
      table_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE _socket_metadata.remote_mysql_servers ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE _socket_metadata.remote_mysql_servers ADD COLUMN IF NOT EXISTS sync_interval_mins INTEGER DEFAULT 60;
    ALTER TABLE _socket_metadata.remote_mysql_servers ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
    ALTER TABLE _socket_metadata.remote_mysql_servers ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle';
    ALTER TABLE _socket_metadata.remote_mysql_servers ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 0;


    CREATE TABLE IF NOT EXISTS _socket_metadata.compute_nodes (
      id SERIAL PRIMARY KEY,
      project_ref TEXT NOT NULL,
      node_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      auth_token TEXT NOT NULL,
      role TEXT DEFAULT 'worker',
      cpu_cores INTEGER DEFAULT 1,
      cpu_usage_pct NUMERIC(5,2) DEFAULT 0,
      memory_total_mb INTEGER DEFAULT 1024,
      memory_used_mb INTEGER DEFAULT 256,
      disk_free_gb NUMERIC(6,2) DEFAULT 10,
      os_info TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'online',
      last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS _socket_metadata.compute_tasks (
      id SERIAL PRIMARY KEY,
      task_id TEXT UNIQUE NOT NULL DEFAULT ('task_' || floor(random()*1000000)::text),
      project_ref TEXT NOT NULL,
      node_id TEXT DEFAULT 'any',
      title TEXT NOT NULL DEFAULT 'Compute Task',
      task_type TEXT NOT NULL DEFAULT 'bash_command',
      command TEXT,
      payload JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'pending',
      output TEXT,
      exit_code INTEGER,
      started_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS task_id TEXT;
    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS command TEXT;
    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS output TEXT;
    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS exit_code INTEGER;
    ALTER TABLE _socket_metadata.compute_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

    SELECT setval(pg_get_serial_sequence('_socket_metadata.organizations', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.organizations;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.projects', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.projects;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.organization_members', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.organization_members;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.organization_invitations', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.organization_invitations;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.personal_access_tokens', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.personal_access_tokens;
    SELECT setval(pg_get_serial_sequence('_socket_metadata.user_profiles', 'id'), coalesce(max(id), 1)) FROM _socket_metadata.user_profiles;
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

export async function getSocketOrganizationBySlug(slug: string): Promise<SocketOrganization | null> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<{
    id: number
    name: string
    slug: string
    billing_email: string
    plan_id: string
  }>({
    query: `SELECT id, name, slug, billing_email, plan_id FROM _socket_metadata.organizations WHERE slug = $1`,
    parameters: [slug],
  })

  if (error || !data || data.length === 0) {
    if (slug === 'default-org-slug' || slug === 'default') {
      return {
        id: 1,
        name: 'Socket Organization',
        slug: 'default-org-slug',
        billing_email: 'admin@socket.dev',
        plan: { id: 'enterprise', name: 'Enterprise' },
      }
    }
    return null
  }

  const org = data[0]
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    billing_email: org.billing_email || 'admin@socket.dev',
    plan: { id: org.plan_id || 'enterprise', name: 'Enterprise' },
  }
}

export async function createSocketOrganization(
  input: string | { name: string }
): Promise<SocketOrganization> {
  await ensureMetadataSchema()

  const rawName = typeof input === 'string' ? input : input?.name
  const trimmedName = (rawName || '').trim()
  if (!trimmedName) {
    throw new Error('Organization name is required')
  }

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

  // Automatically insert owner member into _socket_metadata.organization_members
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.organization_members (
        organization_id, primary_email, username, role_id, mfa_enabled, gotrue_id
      ) VALUES ($1, 'admin@socket.dev', 'admin', 1, false, '00000000-0000-0000-0000-000000000001')
      ON CONFLICT (organization_id, primary_email) DO NOTHING
    `,
    parameters: [row.id],
  })

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

export async function getSocketOrganizationMembers(slug: string): Promise<SocketMember[]> {
  await ensureMetadataSchema()

  const org = await getSocketOrganizationBySlug(slug)
  if (!org) return []

  const { data, error } = await executeQuery<SocketMember>({
    query: `
      SELECT id, organization_id, primary_email, username, role_id,
             coalesce(project_scoped_roles, '[]'::jsonb) as project_scoped_roles,
             mfa_enabled, gotrue_id, created_at
      FROM _socket_metadata.organization_members
      WHERE organization_id = $1
      ORDER BY id ASC
    `,
    parameters: [org.id],
  })

  if (error || !data) {
    console.error('Failed to query organization members:', error)
    return []
  }

  return data
}

export async function getSocketOrganizationInvitations(slug: string): Promise<SocketInvitation[]> {
  await ensureMetadataSchema()

  const org = await getSocketOrganizationBySlug(slug)
  if (!org) return []

  const { data, error } = await executeQuery<SocketInvitation>({
    query: `
      SELECT id, organization_id, invited_email, role_id,
             coalesce(role_scoped_projects, '[]'::jsonb) as role_scoped_projects,
             token, invited_at, expires_at, status
      FROM _socket_metadata.organization_invitations
      WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW()
      ORDER BY id DESC
    `,
    parameters: [org.id],
  })

  if (error || !data) {
    console.error('Failed to query organization invitations:', error)
    return []
  }

  return data
}

export async function createSocketOrganizationInvitation(
  slug: string,
  email: string,
  roleId: number,
  roleScopedProjects: string[] = []
): Promise<SocketInvitation> {
  await ensureMetadataSchema()

  const org = await getSocketOrganizationBySlug(slug)
  if (!org) {
    throw new Error('Organization not found')
  }

  const token = crypto.randomBytes(24).toString('hex')
  const cleanEmail = email.trim().toLowerCase()

  const { data, error } = await executeQuery<SocketInvitation>({
    query: `
      INSERT INTO _socket_metadata.organization_invitations (
        organization_id, invited_email, role_id, role_scoped_projects, token
      )
      VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING id, organization_id, invited_email, role_id, role_scoped_projects, token, invited_at, expires_at, status
    `,
    parameters: [org.id, cleanEmail, roleId, JSON.stringify(roleScopedProjects), token],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to create invitation')
  }

  return data[0]
}

export async function deleteSocketOrganizationInvitation(id: number): Promise<boolean> {
  await ensureMetadataSchema()

  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.organization_invitations WHERE id = $1`,
    parameters: [id],
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete invitation')
  }

  return true
}

export async function deleteSocketOrganizationMember(slug: string, gotrueIdOrId: string | number): Promise<boolean> {
  await ensureMetadataSchema()

  const org = await getSocketOrganizationBySlug(slug)
  if (!org) {
    throw new Error('Organization not found')
  }

  const isNumeric = typeof gotrueIdOrId === 'number' || /^\d+$/.test(String(gotrueIdOrId))

  const { error } = await executeQuery({
    query: isNumeric
      ? `DELETE FROM _socket_metadata.organization_members WHERE organization_id = $1 AND id = $2`
      : `DELETE FROM _socket_metadata.organization_members WHERE organization_id = $1 AND (gotrue_id = $2 OR primary_email = $2)`,
    parameters: [org.id, gotrueIdOrId],
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete member')
  }

  return true
}

export async function updateSocketOrganizationMemberRole(
  slug: string,
  gotrueIdOrId: string | number,
  roleId: number,
  projectScopedRoles?: string[]
): Promise<SocketMember> {
  await ensureMetadataSchema()

  const org = await getSocketOrganizationBySlug(slug)
  if (!org) {
    throw new Error('Organization not found')
  }

  const isNumeric = typeof gotrueIdOrId === 'number' || /^\d+$/.test(String(gotrueIdOrId))

  const { data, error } = await executeQuery<SocketMember>({
    query: isNumeric
      ? `
        UPDATE _socket_metadata.organization_members
        SET role_id = $1,
            project_scoped_roles = CASE WHEN $2::jsonb IS NOT NULL THEN $2::jsonb ELSE project_scoped_roles END
        WHERE organization_id = $3 AND id = $4
        RETURNING id, organization_id, primary_email, username, role_id,
                  coalesce(project_scoped_roles, '[]'::jsonb) as project_scoped_roles,
                  mfa_enabled, gotrue_id, created_at
      `
      : `
        UPDATE _socket_metadata.organization_members
        SET role_id = $1,
            project_scoped_roles = CASE WHEN $2::jsonb IS NOT NULL THEN $2::jsonb ELSE project_scoped_roles END
        WHERE organization_id = $3 AND (gotrue_id = $4 OR primary_email = $4)
        RETURNING id, organization_id, primary_email, username, role_id,
                  coalesce(project_scoped_roles, '[]'::jsonb) as project_scoped_roles,
                  mfa_enabled, gotrue_id, created_at
      `,
    parameters: [
      roleId,
      projectScopedRoles !== undefined ? JSON.stringify(projectScopedRoles) : null,
      org.id,
      gotrueIdOrId,
    ],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to update member role')
  }

  return data[0]
}

export async function getSocketInvitationByToken(token: string) {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<{
    id: number
    organization_id: number
    organization_name: string
    organization_slug: string
    invited_email: string
    role_id: number
    token: string
    invited_at: string
    expires_at: string
    status: string
  }>({
    query: `
      SELECT i.id, i.organization_id, o.name as organization_name, o.slug as organization_slug,
             i.invited_email, i.role_id, i.token, i.invited_at, i.expires_at, i.status
      FROM _socket_metadata.organization_invitations i
      JOIN _socket_metadata.organizations o ON o.id = i.organization_id
      WHERE i.token = $1
    `,
    parameters: [token],
  })

  if (error || !data || data.length === 0) {
    return { token_does_not_exist: true }
  }

  const invite = data[0]
  const isExpired = new Date(invite.expires_at) < new Date() || invite.status !== 'pending'
  if (isExpired) {
    return { expired_token: true }
  }

  const roleNames: Record<number, string> = {
    1: 'Owner',
    2: 'Administrator',
    3: 'Developer',
    4: 'Read-only',
  }

  return {
    token_does_not_exist: false,
    expired_token: false,
    email_match: true,
    organization_name: invite.organization_name,
    organization_slug: invite.organization_slug,
    role_name: roleNames[invite.role_id] || 'Developer',
    invited_email: invite.invited_email,
  }
}

export async function acceptSocketInvitation(token: string, userEmail?: string, userId?: string) {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketInvitation>({
    query: `SELECT * FROM _socket_metadata.organization_invitations WHERE token = $1`,
    parameters: [token],
  })

  if (error || !data || data.length === 0) {
    throw new Error('Invitation not found')
  }

  const invite = data[0]
  if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
    throw new Error('Invitation has expired or already been accepted')
  }

  const email = userEmail || invite.invited_email
  const gotrueId = userId || `user-${Date.now()}`
  const username = email.split('@')[0]
  const projectRoles = invite.role_scoped_projects || []

  // Add to members
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.organization_members (
        organization_id, primary_email, username, role_id, gotrue_id, project_scoped_roles
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (organization_id, primary_email)
      DO UPDATE SET role_id = EXCLUDED.role_id, gotrue_id = EXCLUDED.gotrue_id, project_scoped_roles = EXCLUDED.project_scoped_roles
    `,
    parameters: [invite.organization_id, email, username, invite.role_id, gotrueId, JSON.stringify(projectRoles)],
  })

  // Mark invite as accepted
  await executeQuery({
    query: `UPDATE _socket_metadata.organization_invitations SET status = 'accepted' WHERE id = $1`,
    parameters: [invite.id],
  })

  return { success: true }
}

export async function getSocketProjectAuthConfig(projectRef: string): Promise<Record<string, any>> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<{
    project_ref: string
    config: Record<string, any>
  }>({
    query: `SELECT config FROM _socket_metadata.project_auth_config WHERE project_ref = $1`,
    parameters: [projectRef],
  })

  if (error || !data || data.length === 0) {
    return {}
  }

  const row = data[0]
  return typeof row.config === 'object' && row.config !== null ? row.config : {}
}

export async function updateSocketProjectAuthConfig(
  projectRef: string,
  updates: Record<string, any>
): Promise<Record<string, any>> {
  await ensureMetadataSchema()

  const current = await getSocketProjectAuthConfig(projectRef)
  const merged = { ...current, ...updates }

  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.project_auth_config (project_ref, config, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (project_ref) DO UPDATE
      SET config = EXCLUDED.config, updated_at = NOW()
    `,
    parameters: [projectRef, JSON.stringify(merged)],
  })

  return merged
}

export interface SocketUserProfile {
  id: number
  gotrue_id: string
  primary_email: string
  username: string
  first_name: string
  last_name: string
}

export interface SocketPersonalAccessToken {
  id: number
  name: string
  token_alias: string
  created_at: string
  last_used_at?: string | null
  expires_at?: string | null
  scope?: string
}

export async function getSocketUserProfile(): Promise<SocketUserProfile> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketUserProfile>({
    query: `SELECT id, gotrue_id, primary_email, username, first_name, last_name FROM _socket_metadata.user_profiles ORDER BY id ASC LIMIT 1`,
  })

  if (error || !data || data.length === 0) {
    return {
      id: 1,
      gotrue_id: '00000000-0000-0000-0000-000000000001',
      primary_email: 'admin@socket.dev',
      username: 'admin',
      first_name: 'Socket',
      last_name: 'Admin',
    }
  }

  return data[0]
}

export async function updateSocketUserProfile(updates: {
  first_name?: string
  last_name?: string
  username?: string
  primary_email?: string
}): Promise<SocketUserProfile> {
  await ensureMetadataSchema()

  const current = await getSocketUserProfile()
  const firstName = updates.first_name !== undefined ? updates.first_name.trim() : current.first_name
  const lastName = updates.last_name !== undefined ? updates.last_name.trim() : current.last_name
  const username = updates.username !== undefined ? updates.username.trim() : current.username
  const primaryEmail = updates.primary_email !== undefined ? updates.primary_email.trim().toLowerCase() : current.primary_email

  const { data, error } = await executeQuery<SocketUserProfile>({
    query: `
      UPDATE _socket_metadata.user_profiles
      SET first_name = $1, last_name = $2, username = $3, primary_email = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING id, gotrue_id, primary_email, username, first_name, last_name
    `,
    parameters: [firstName, lastName, username, primaryEmail, current.id],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to update profile')
  }

  // Also sync member record for org 1 if exists
  try {
    await executeQuery({
      query: `UPDATE _socket_metadata.organization_members SET primary_email = $1, username = $2 WHERE gotrue_id = $3`,
      parameters: [primaryEmail, username, current.gotrue_id],
    })
  } catch (err) {
    // Non-critical
  }

  return data[0]
}

export async function getSocketPersonalAccessTokens(): Promise<SocketPersonalAccessToken[]> {
  await ensureMetadataSchema()

  const { data, error } = await executeQuery<SocketPersonalAccessToken>({
    query: `SELECT id, name, token_alias, created_at, last_used_at, expires_at, scope FROM _socket_metadata.personal_access_tokens ORDER BY id DESC`,
  })

  if (error || !data) {
    return []
  }

  return data
}

export async function createSocketPersonalAccessToken(params: {
  name: string
  scope?: string
  expires_at?: string
}): Promise<{
  id: number
  name: string
  token_alias: string
  token: string
  created_at: string
}> {
  await ensureMetadataSchema()

  const rawTokenSecret = `skt_${crypto.randomBytes(32).toString('hex')}`
  const tokenAlias = `${rawTokenSecret.substring(0, 7)}...${rawTokenSecret.slice(-4)}`
  const tokenHash = crypto.createHash('sha256').update(rawTokenSecret).digest('hex')

  const { data, error } = await executeQuery<{
    id: number
    name: string
    token_alias: string
    created_at: string
  }>({
    query: `
      INSERT INTO _socket_metadata.personal_access_tokens (
        name, token_alias, token_hash, scope, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, token_alias, created_at
    `,
    parameters: [
      params.name.trim(),
      tokenAlias,
      tokenHash,
      params.scope || 'all',
      params.expires_at || null,
    ],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to create access token')
  }

  return {
    ...data[0],
    token: rawTokenSecret,
  }
}

export async function deleteSocketPersonalAccessToken(id: number | string): Promise<boolean> {
  await ensureMetadataSchema()

  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.personal_access_tokens WHERE id = $1`,
    parameters: [Number(id)],
  })

  if (error) {
    throw new Error(error.message || 'Failed to delete token')
  }

  return true
}

export async function getSocketAuditLogs(): Promise<any[]> {
  return [
    {
      action: {
        name: 'user.login',
        metadata: [{ method: 'POST', route: '/api/login', status: 200 }],
      },
      actor: {
        id: '00000000-0000-0000-0000-000000000001',
        type: 'user',
        metadata: [{ email: 'admin@socket.dev', tokenType: 'session' }],
      },
      occurred_at: new Date().toISOString(),
      target: {
        description: 'Default Project',
        metadata: {
          project_ref: 'default',
          ref: 'default',
          org_slug: 'default-org-slug',
          slug: 'default-org-slug',
        },
      },
    },
    {
      action: {
        name: 'project.access',
        metadata: [{ method: 'GET', route: '/project/default', status: 200 }],
      },
      actor: {
        id: '00000000-0000-0000-0000-000000000001',
        type: 'user',
        metadata: [{ email: 'admin@socket.dev', tokenType: 'session' }],
      },
      occurred_at: new Date(Date.now() - 3600000).toISOString(),
      target: {
        description: 'Default Project',
        metadata: {
          project_ref: 'default',
          ref: 'default',
          org_slug: 'default-org-slug',
          slug: 'default-org-slug',
        },
      },
    },
  ]
}

export async function getOrCreateCopilotSession(ref: string = 'default'): Promise<{ id: string; created_at: string }> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<{ id: string; created_at: string }>({
    query: `SELECT id, created_at FROM _socket_metadata.copilot_sessions WHERE project_ref = $1 ORDER BY updated_at DESC LIMIT 1`,
    parameters: [ref],
  })

  if (data && data.length > 0) {
    return data[0]
  }

  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  await executeQuery({
    query: `INSERT INTO _socket_metadata.copilot_sessions (id, project_ref) VALUES ($1, $2)`,
    parameters: [newId, ref],
  })

  return { id: newId, created_at: new Date().toISOString() }
}

export async function deleteCopilotSession(sessionId: string): Promise<boolean> {
  await ensureMetadataSchema()
  await executeQuery({
    query: `DELETE FROM _socket_metadata.copilot_sessions WHERE id = $1`,
    parameters: [sessionId],
  })
  return true
}

export async function getCopilotMessages(sessionId: string): Promise<any[]> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<{
    id: string
    role: string
    content: string
    guide_event: any
    created_at: string
  }>({
    query: `SELECT id, role, content, guide_event, created_at FROM _socket_metadata.copilot_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    parameters: [sessionId],
  })
  return data ?? []
}

export async function saveCopilotMessage(
  sessionId: string,
  message: { id: string; role: string; content: string; guide_event?: any }
): Promise<void> {
  await ensureMetadataSchema()
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.copilot_messages (id, session_id, role, content, guide_event)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET content = $4
    `,
    parameters: [message.id, sessionId, message.role, message.content, JSON.stringify(message.guide_event ?? null)],
  })

  await executeQuery({
    query: `UPDATE _socket_metadata.copilot_sessions SET updated_at = NOW() WHERE id = $1`,
    parameters: [sessionId],
  })
}

export async function getCopilotSettings(ref: string = 'default'): Promise<{ warn_on_delete: boolean; model: string }> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<{ warn_on_delete: boolean; model: string }>({
    query: `SELECT warn_on_delete, model FROM _socket_metadata.copilot_settings WHERE project_ref = $1 LIMIT 1`,
    parameters: [ref],
  })

  if (data && data.length > 0) {
    return {
      warn_on_delete: data[0].warn_on_delete ?? true,
      model: data[0].model ?? 'auto',
    }
  }

  return { warn_on_delete: true, model: 'auto' }
}

export async function updateCopilotSettings(
  ref: string = 'default',
  settings: { warn_on_delete?: boolean; model?: string }
): Promise<boolean> {
  await ensureMetadataSchema()
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.copilot_settings (project_ref, warn_on_delete, model, updated_at)
      VALUES ($1, coalesce($2, true), coalesce($3, 'auto'), NOW())
      ON CONFLICT (project_ref) DO UPDATE
      SET warn_on_delete = coalesce($2, _socket_metadata.copilot_settings.warn_on_delete),
          model = coalesce($3, _socket_metadata.copilot_settings.model),
          updated_at = NOW()
    `,
    parameters: [ref, settings.warn_on_delete ?? null, settings.model ?? null],
  })
  return true
}

export interface SocketBranch {
  id: string
  project_ref: string
  parent_project_ref?: string
  name: string
  git_branch?: string
  is_default: boolean
  status: string
  preview_project_status: string
  db_schema: string
  persistent: boolean
  with_data: boolean
  created_at: string
  updated_at: string
}

export async function getSocketBranches(projectRef: string = 'default'): Promise<any[]> {
  await ensureMetadataSchema()

  // Ensure default main branch exists for this projectRef
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.branches (
        id, project_ref, name, git_branch, is_default, status, preview_project_status, db_schema
      )
      VALUES (
        $1, $2, 'main', 'main', TRUE, 'MIGRATIONS_PASSED', 'ACTIVE_HEALTHY', 'public'
      )
      ON CONFLICT (project_ref, name) DO NOTHING
    `,
    parameters: [`main_${projectRef}`, projectRef],
  })

  const { data, error } = await executeQuery<any>({
    query: `
      SELECT id, project_ref, name, git_branch, is_default, status,
             preview_project_status, db_schema, persistent, with_data,
             subdomain, custom_domain, ssl_status, api_url,
             created_at, updated_at
      FROM _socket_metadata.branches
      WHERE project_ref = $1
      ORDER BY is_default DESC, created_at DESC
    `,
    parameters: [projectRef],
  })

  if (error || !data) {
    return [
      {
        id: `main_${projectRef}`,
        name: 'main',
        project_ref: projectRef,
        parent_project_ref: projectRef,
        git_branch: 'main',
        is_default: true,
        status: 'MIGRATIONS_PASSED',
        preview_project_status: 'ACTIVE_HEALTHY',
        persistent: true,
        with_data: true,
        subdomain: 'main.backend.freightsolution.xyz',
        custom_domain: null,
        ssl_status: 'active',
        api_url: 'https://backend.freightsolution.xyz',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
  }

  return data.map((b) => ({
    id: b.id,
    name: b.name,
    project_ref: b.is_default ? b.project_ref : `${b.project_ref}-${b.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
    parent_project_ref: b.project_ref,
    git_branch: b.git_branch || b.name,
    is_default: b.is_default,
    status: b.status || 'MIGRATIONS_PASSED',
    preview_project_status: b.preview_project_status || 'ACTIVE_HEALTHY',
    persistent: b.persistent ?? true,
    with_data: b.with_data ?? true,
    subdomain: b.subdomain || (b.is_default ? 'main.backend.freightsolution.xyz' : `${b.name.toLowerCase()}-preview.backend.freightsolution.xyz`),
    custom_domain: b.custom_domain,
    ssl_status: b.ssl_status || 'active',
    api_url: b.api_url || (b.is_default ? 'https://backend.freightsolution.xyz' : `https://${b.name.toLowerCase()}-preview.backend.freightsolution.xyz`),
    created_at: b.created_at,
    updated_at: b.updated_at,
  }))
}

export async function updateSocketBranchDomain(
  branchId: string,
  domain: string
): Promise<boolean> {
  await ensureMetadataSchema()
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const { error } = await executeQuery({
    query: `
      UPDATE _socket_metadata.branches
      SET custom_domain = $2,
          ssl_status = 'active',
          updated_at = NOW()
      WHERE id = $1
    `,
    parameters: [branchId, cleanDomain],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function createSocketBranch({
  projectRef = 'default',
  branchName,
  gitBranch,
  withData = true,
}: {
  projectRef: string
  branchName: string
  gitBranch?: string
  withData?: boolean
}): Promise<any> {
  await ensureMetadataSchema()

  const cleanName = branchName.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
  if (!cleanName) throw new Error('Branch name is invalid')

  const branchSchema = `branch_${cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
  const branchId = `branch_${cleanName}_${Math.random().toString(36).substring(2, 8)}`
  const childProjectRef = `${projectRef}-${cleanName.toLowerCase()}`
  const hostDomain = 'backend.freightsolution.xyz'
  const autoSubdomain = `${cleanName.toLowerCase()}-preview.${hostDomain}`
  const autoApiUrl = `https://${autoSubdomain}`

  // 1. Provision isolated Postgres schema
  await executeQuery({
    query: `CREATE SCHEMA IF NOT EXISTS "${branchSchema}";`,
  })

  // 2. Clone tables/data if withData is true
  if (withData) {
    await executeQuery({
      query: `
        DO $$
        DECLARE
          t record;
        BEGIN
          FOR t IN
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          LOOP
            BEGIN
              EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I (LIKE public.%I INCLUDING ALL)', '${branchSchema}', t.table_name, t.table_name);
              EXECUTE format('INSERT INTO %I.%I SELECT * FROM public.%I ON CONFLICT DO NOTHING', '${branchSchema}', t.table_name, t.table_name);
            EXCEPTION WHEN OTHERS THEN
              -- Continue even if one table has unsupported dependencies
            END;
          END LOOP;
        END $$;
      `,
    })
  }

  // 3. Insert branch record into metadata
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.branches (
        id, project_ref, name, git_branch, is_default, status,
        preview_project_status, db_schema, persistent, with_data,
        subdomain, api_url, ssl_status
      )
      VALUES ($1, $2, $3, $4, FALSE, 'MIGRATIONS_PASSED', 'ACTIVE_HEALTHY', $5, TRUE, $6, $7, $8, 'active')
      ON CONFLICT (project_ref, name) DO UPDATE
      SET updated_at = NOW(), status = 'MIGRATIONS_PASSED', subdomain = $7, api_url = $8
    `,
    parameters: [branchId, projectRef, cleanName, gitBranch || cleanName, branchSchema, withData, autoSubdomain, autoApiUrl],
  })

  // 4. Register child project in _socket_metadata.projects so studio queries work
  const parentProj = await getSocketProjectByRef(projectRef)
  await executeQuery({
    query: `
      INSERT INTO _socket_metadata.projects (
        ref, name, organization_id, cloud_provider, status, region, db_schema,
        jwt_secret, anon_key, service_role_key
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE_HEALTHY', $5, $6, $7, $8, $9)
      ON CONFLICT (ref) DO UPDATE SET db_schema = $6
    `,
    parameters: [
      childProjectRef,
      `${parentProj?.name || 'Project'} (${cleanName})`,
      parentProj?.organization_id || 1,
      parentProj?.cloud_provider || 'localhost',
      parentProj?.region || 'local',
      branchSchema,
      parentProj?.jwt_secret,
      parentProj?.anon_key,
      parentProj?.service_role_key,
    ],
  })

  return {
    id: branchId,
    name: cleanName,
    project_ref: childProjectRef,
    parent_project_ref: projectRef,
    git_branch: gitBranch || cleanName,
    is_default: false,
    status: 'MIGRATIONS_PASSED',
    preview_project_status: 'ACTIVE_HEALTHY',
    persistent: true,
    with_data: withData,
    subdomain: autoSubdomain,
    custom_domain: null,
    ssl_status: 'active',
    api_url: autoApiUrl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function deleteSocketBranch(branchIdOrRef: string): Promise<boolean> {
  await ensureMetadataSchema()

  const { data } = await executeQuery<any>({
    query: `
      SELECT id, project_ref, name, is_default, db_schema
      FROM _socket_metadata.branches
      WHERE id = $1 OR name = $1 OR project_ref || '-' || name = $1
      LIMIT 1
    `,
    parameters: [branchIdOrRef],
  })

  if (!data || data.length === 0) return false
  const branch = data[0]

  if (branch.is_default || branch.name === 'main') {
    throw new Error('Cannot delete the default production branch')
  }

  // 1. Drop isolated schema
  if (branch.db_schema && branch.db_schema !== 'public') {
    await executeQuery({
      query: `DROP SCHEMA IF EXISTS "${branch.db_schema}" CASCADE;`,
    })
  }

  // 2. Delete branch record
  await executeQuery({
    query: `DELETE FROM _socket_metadata.branches WHERE id = $1`,
    parameters: [branch.id],
  })

  // 3. Delete child project record
  const childProjectRef = `${branch.project_ref}-${branch.name.toLowerCase()}`
  await executeQuery({
    query: `DELETE FROM _socket_metadata.projects WHERE ref = $1`,
    parameters: [childProjectRef],
  })

  return true
}

export async function getSocketBranchByIdOrRef(branchIdOrRef: string): Promise<any | null> {
  await ensureMetadataSchema()

  const { data } = await executeQuery<any>({
    query: `
      SELECT id, project_ref, name, git_branch, is_default, status,
             preview_project_status, db_schema, persistent, with_data,
             created_at, updated_at
      FROM _socket_metadata.branches
      WHERE id = $1 OR name = $1 OR project_ref || '-' || name = $1
      LIMIT 1
    `,
    parameters: [branchIdOrRef],
  })

  if (!data || data.length === 0) return null
  const b = data[0]
  return {
    id: b.id,
    name: b.name,
    project_ref: b.is_default ? b.project_ref : `${b.project_ref}-${b.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
    parent_project_ref: b.project_ref,
    git_branch: b.git_branch || b.name,
    is_default: b.is_default,
    status: b.status || 'MIGRATIONS_PASSED',
    preview_project_status: b.preview_project_status || 'ACTIVE_HEALTHY',
    persistent: b.persistent ?? true,
    with_data: b.with_data ?? true,
    created_at: b.created_at,
    updated_at: b.updated_at,
  }
}

export interface SocketStorageGateway {
  id: number
  project_ref: string
  name: string
  endpoint_url: string
  region: string
  access_key: string
  secret_key: string
  is_active: boolean
  created_at: string
}

export async function getSocketStorageGateways(projectRef: string): Promise<SocketStorageGateway[]> {
  await ensureMetadataSchema()
  const { data, error } = await executeQuery<SocketStorageGateway>({
    query: `SELECT * FROM _socket_metadata.remote_storage_gateways WHERE project_ref = $1 ORDER BY id DESC`,
    parameters: [projectRef],
  })
  if (error || !data) return []
  return data
}

export async function createSocketStorageGateway(
  projectRef: string,
  gateway: {
    name: string
    endpoint_url: string
    region?: string
    access_key: string
    secret_key: string
  }
): Promise<SocketStorageGateway> {
  await ensureMetadataSchema()
  const { data, error } = await executeQuery<SocketStorageGateway>({
    query: `
      INSERT INTO _socket_metadata.remote_storage_gateways (
        project_ref, name, endpoint_url, region, access_key, secret_key
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    parameters: [
      projectRef,
      gateway.name,
      gateway.endpoint_url.trim(),
      gateway.region || 'us-east-1',
      gateway.access_key.trim(),
      gateway.secret_key.trim(),
    ],
  })
  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to save storage gateway')
  }
  return data[0]
}

export async function deleteSocketStorageGateway(id: number): Promise<boolean> {
  await ensureMetadataSchema()
  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.remote_storage_gateways WHERE id = $1`,
    parameters: [id],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function getSocketStorageGatewayById(id: number): Promise<SocketStorageGateway | null> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<SocketStorageGateway>({
    query: `SELECT * FROM _socket_metadata.remote_storage_gateways WHERE id = $1`,
    parameters: [id],
  })
  if (!data || data.length === 0) return null
  return data[0]
}

export function createSigV4PresignedUrl({
  endpointUrl,
  region,
  accessKey,
  secretKey,
  bucket,
  key,
  expiresIn = 3600,
  method = 'GET',
}: {
  endpointUrl: string
  region: string
  accessKey: string
  secretKey: string
  bucket: string
  key: string
  expiresIn?: number
  method?: string
}): string {
  const cleanEndpoint = endpointUrl.trim().replace(/\/+$/, '')
  const urlObj = new URL(cleanEndpoint)
  const host = urlObj.host
  const path = `${urlObj.pathname}/${bucket}/${key}`.replace(/\/+/g, '/')
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  })

  const canonicalQueryString = Array.from(queryParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalHeaders = `host:${host}\n`
  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  return `${urlObj.origin}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`
}

export async function listRemoteGatewayBuckets(id: number): Promise<string[]> {
  const gw = await getSocketStorageGatewayById(id)
  if (!gw) throw new Error('Gateway not found')

  const cleanUrl = gw.endpoint_url.trim().replace(/\/+$/, '')
  try {
    const res = await fetch(`${cleanUrl}/`, {
      headers: {
        Accept: 'application/xml',
        Authorization: `Bearer ${gw.secret_key}`,
      },
    })
    const text = await res.text()
    const matches = Array.from(text.matchAll(/<Name>(.*?)<\/Name>/g)).map((m) => m[1])
    if (matches.length > 0) {
      return Array.from(new Set(matches))
    }
  } catch (err) {
    // fallback
  }
  return ['default', 'uploads', 'media']
}

export interface RemoteGatewayFile {
  key: string
  name: string
  size: number
  last_modified: string
  url: string
}

export async function listRemoteGatewayFiles(
  id: number,
  bucket: string,
  prefix?: string
): Promise<RemoteGatewayFile[]> {
  const gw = await getSocketStorageGatewayById(id)
  if (!gw) throw new Error('Gateway not found')

  const cleanUrl = gw.endpoint_url.trim().replace(/\/+$/, '')
  const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''

  try {
    const res = await fetch(`${cleanUrl}/${bucket}${query}`, {
      headers: {
        Accept: 'application/xml',
        Authorization: `Bearer ${gw.secret_key}`,
      },
    })
    const text = await res.text()

    const files: RemoteGatewayFile[] = []
    const contentBlocks = text.split('<Contents>')
    for (let i = 1; i < contentBlocks.length; i++) {
      const block = contentBlocks[i].split('</Contents>')[0]
      const keyMatch = block.match(/<Key>(.*?)<\/Key>/)
      const sizeMatch = block.match(/<Size>(.*?)<\/Size>/)
      const lastModMatch = block.match(/<LastModified>(.*?)<\/LastModified>/)

      if (keyMatch) {
        const key = keyMatch[1]
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
        const lastModified = lastModMatch ? lastModMatch[1] : new Date().toISOString()
        const presignedUrl = createSigV4PresignedUrl({
          endpointUrl: gw.endpoint_url,
          region: gw.region || 'us-east-1',
          accessKey: gw.access_key,
          secretKey: gw.secret_key,
          bucket,
          key,
          expiresIn: 86400, // 24 hours
        })

        files.push({
          key,
          name: key.split('/').pop() || key,
          size,
          last_modified: lastModified,
          url: presignedUrl,
        })
      }
    }

    return files
  } catch (err: any) {
    return []
  }
}

export async function deleteRemoteGatewayFile(
  id: number,
  bucket: string,
  key: string
): Promise<boolean> {
  const gw = await getSocketStorageGatewayById(id)
  if (!gw) throw new Error('Gateway not found')

  const cleanUrl = gw.endpoint_url.trim().replace(/\/+$/, '')
  const res = await fetch(`${cleanUrl}/${bucket}/${key}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${gw.secret_key}`,
    },
  })
  return res.ok || res.status === 204
}

export interface SocketMySQLConnector {
  id: number
  project_ref: string
  name: string
  host: string
  port: number
  database_name: string
  username: string
  foreign_schema: string
  status: string
  auto_sync_enabled?: boolean
  sync_interval_mins?: number
  last_synced_at?: string
  sync_status?: string
  table_count?: number
  created_at: string
}

export async function getSocketMySQLConnectors(projectRef: string): Promise<SocketMySQLConnector[]> {
  await ensureMetadataSchema()
  const { data, error } = await executeQuery<SocketMySQLConnector>({
    query: `
      SELECT id, project_ref, name, host, port, database_name, username, foreign_schema, status,
             auto_sync_enabled, sync_interval_mins, last_synced_at, sync_status, table_count, created_at
      FROM _socket_metadata.remote_mysql_servers
      WHERE project_ref = $1
      ORDER BY id DESC
    `,
    parameters: [projectRef],
  })
  if (error || !data) return []
  return data
}

export async function syncSocketMySQLConnector(id: number): Promise<{
  success: boolean
  table_count: number
  tables: Array<{ table_name: string; column_count: number }>
}> {
  await ensureMetadataSchema()
  const { data: rows, error: fetchErr } = await executeQuery<{
    id: number
    host: string
    port: number
    database_name: string
    username: string
    password: string
    foreign_schema: string
  }>({
    query: `SELECT id, host, port, database_name, username, password, foreign_schema FROM _socket_metadata.remote_mysql_servers WHERE id = $1`,
    parameters: [id],
  })

  if (fetchErr || !rows || rows.length === 0) {
    throw new Error('Connector not found')
  }

  const connector = rows[0]
  const safeSchema = connector.foreign_schema
  const serverName = `mysql_srv_${safeSchema}`
  const port = connector.port || 3306

  await executeQuery({
    query: `UPDATE _socket_metadata.remote_mysql_servers SET sync_status = 'syncing' WHERE id = $1`,
    parameters: [id],
  })

  try {
    // 1. Ensure foreign server and mapping exist
    await executeQuery({
      query: `
        CREATE EXTENSION IF NOT EXISTS mysql_fdw;
        CREATE SCHEMA IF NOT EXISTS "${safeSchema}";
        DROP SERVER IF EXISTS "${serverName}" CASCADE;
        CREATE SERVER "${serverName}"
          FOREIGN DATA WRAPPER mysql_fdw
          OPTIONS (host '${connector.host.trim().replace(/'/g, "''")}', port '${port}');
        CREATE USER MAPPING FOR postgres
          SERVER "${serverName}"
          OPTIONS (username '${connector.username.trim().replace(/'/g, "''")}', password '${connector.password.replace(/'/g, "''")}');
        CREATE USER MAPPING FOR supabase_admin
          SERVER "${serverName}"
          OPTIONS (username '${connector.username.trim().replace(/'/g, "''")}', password '${connector.password.replace(/'/g, "''")}');
      `,
    })

    // 2. Re-import Foreign Schema
    await executeQuery({
      query: `
        IMPORT FOREIGN SCHEMA "${connector.database_name.trim().replace(/"/g, '""')}"
          FROM SERVER "${serverName}"
          INTO "${safeSchema}";
        GRANT USAGE ON SCHEMA "${safeSchema}" TO postgres, anon, authenticated, service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${safeSchema}" TO postgres, anon, authenticated, service_role;
      `,
    })

    // 3. Query imported tables
    const { data: tables } = await executeQuery<{ table_name: string; column_count: string }>({
      query: `
        SELECT 
          c.relname as table_name,
          (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = $1 AND table_name = c.relname) as column_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'f'
        ORDER BY c.relname ASC
      `,
      parameters: [safeSchema],
    })

    const tableList = (tables || []).map((t) => ({
      table_name: t.table_name,
      column_count: parseInt(t.column_count || '0', 10),
    }))

    await executeQuery({
      query: `
        UPDATE _socket_metadata.remote_mysql_servers
        SET sync_status = 'synced',
            last_synced_at = NOW(),
            table_count = $2
        WHERE id = $1
      `,
      parameters: [id, tableList.length],
    })

    return {
      success: true,
      table_count: tableList.length,
      tables: tableList,
    }
  } catch (err: any) {
    await executeQuery({
      query: `UPDATE _socket_metadata.remote_mysql_servers SET sync_status = 'error' WHERE id = $1`,
      parameters: [id],
    })
    throw err
  }
}

export async function getSocketMySQLConnectorTables(id: number): Promise<Array<{
  table_name: string
  column_count: number
  columns: Array<{
    column_name: string
    data_type: string
    is_nullable: string
  }>
}>> {
  await ensureMetadataSchema()
  const { data: rows } = await executeQuery<{ foreign_schema: string }>({
    query: `SELECT foreign_schema FROM _socket_metadata.remote_mysql_servers WHERE id = $1`,
    parameters: [id],
  })
  if (!rows || rows.length === 0) return []
  const schema = rows[0].foreign_schema

  const { data: cols } = await executeQuery<{
    table_name: string
    column_name: string
    data_type: string
    is_nullable: string
  }>({
    query: `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position
    `,
    parameters: [schema],
  })

  if (!cols) return []

  const tableMap = new Map<string, Array<{ column_name: string; data_type: string; is_nullable: string }>>()
  for (const c of cols) {
    if (!tableMap.has(c.table_name)) {
      tableMap.set(c.table_name, [])
    }
    tableMap.get(c.table_name)!.push({
      column_name: c.column_name,
      data_type: c.data_type,
      is_nullable: c.is_nullable,
    })
  }

  return Array.from(tableMap.entries()).map(([table_name, columns]) => ({
    table_name,
    column_count: columns.length,
    columns,
  }))
}

export async function getSocketMySQLConnectorTableData(
  id: number,
  tableName: string
): Promise<{ columns: string[]; rows: any[] }> {
  await ensureMetadataSchema()
  const { data: rows } = await executeQuery<{ foreign_schema: string }>({
    query: `SELECT foreign_schema FROM _socket_metadata.remote_mysql_servers WHERE id = $1`,
    parameters: [id],
  })
  if (!rows || rows.length === 0) {
    throw new Error('Connector not found')
  }
  const schema = rows[0].foreign_schema
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '')

  const { data, error } = await executeQuery<any>({
    query: `SELECT * FROM "${schema}"."${safeTable}" LIMIT 50;`,
  })

  if (error) {
    throw new Error(error.message)
  }

  const columns = data && data.length > 0 ? Object.keys(data[0]) : []
  return {
    columns,
    rows: data || [],
  }
}

export async function updateSocketMySQLConnector(
  id: number,
  update: { auto_sync_enabled?: boolean; sync_interval_mins?: number }
): Promise<boolean> {
  await ensureMetadataSchema()
  const { error } = await executeQuery({
    query: `
      UPDATE _socket_metadata.remote_mysql_servers
      SET auto_sync_enabled = COALESCE($2, auto_sync_enabled),
          sync_interval_mins = COALESCE($3, sync_interval_mins)
      WHERE id = $1
    `,
    parameters: [id, update.auto_sync_enabled ?? null, update.sync_interval_mins ?? null],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function createSocketMySQLConnector(
  projectRef: string,
  connector: {
    name: string
    host: string
    port?: number
    database_name: string
    username: string
    password: string
    foreign_schema: string
  }
): Promise<SocketMySQLConnector> {
  await ensureMetadataSchema()
  const port = connector.port || 3306
  const safeSchema = connector.foreign_schema.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const serverName = `mysql_srv_${safeSchema}`

  // 1. Ensure mysql_fdw extension and foreign schema exist
  await executeQuery({
    query: `
      CREATE EXTENSION IF NOT EXISTS mysql_fdw;
      CREATE SCHEMA IF NOT EXISTS "${safeSchema}";
    `,
  })

  // 2. Create Foreign Server
  await executeQuery({
    query: `
      DROP SERVER IF EXISTS "${serverName}" CASCADE;
      CREATE SERVER "${serverName}"
        FOREIGN DATA WRAPPER mysql_fdw
        OPTIONS (host '${connector.host.trim().replace(/'/g, "''")}', port '${port}');
    `,
  })

  // 3. Create User Mappings for both postgres and supabase_admin
  await executeQuery({
    query: `
      CREATE USER MAPPING FOR postgres
        SERVER "${serverName}"
        OPTIONS (username '${connector.username.trim().replace(/'/g, "''")}', password '${connector.password.replace(/'/g, "''")}');
      CREATE USER MAPPING FOR supabase_admin
        SERVER "${serverName}"
        OPTIONS (username '${connector.username.trim().replace(/'/g, "''")}', password '${connector.password.replace(/'/g, "''")}');
    `,
  })

  // 4. Import Foreign Schema from MySQL into PostgreSQL
  const { error: importError } = await executeQuery({
    query: `
      IMPORT FOREIGN SCHEMA "${connector.database_name.trim().replace(/"/g, '""')}"
        FROM SERVER "${serverName}"
        INTO "${safeSchema}";
      GRANT USAGE ON SCHEMA "${safeSchema}" TO postgres, anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${safeSchema}" TO postgres, anon, authenticated, service_role;
    `,
  })

  if (importError) {
    await executeQuery({ query: `DROP SERVER IF EXISTS "${serverName}" CASCADE;` })
    throw new Error(`Failed to import MySQL schema: ${importError.message}`)
  }

  // Count initial tables
  const { data: countData } = await executeQuery<{ count: string }>({
    query: `
      SELECT count(*)::text as count FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'f'
    `,
    parameters: [safeSchema],
  })
  const initialCount = parseInt(countData?.[0]?.count || '0', 10)

  // 5. Save to metadata table
  const { data, error } = await executeQuery<SocketMySQLConnector>({
    query: `
      INSERT INTO _socket_metadata.remote_mysql_servers (
        project_ref, name, host, port, database_name, username, password, foreign_schema, status,
        last_synced_at, sync_status, table_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), 'synced', $9)
      RETURNING id, project_ref, name, host, port, database_name, username, foreign_schema, status,
                auto_sync_enabled, sync_interval_mins, last_synced_at, sync_status, table_count, created_at
    `,
    parameters: [
      projectRef,
      connector.name.trim(),
      connector.host.trim(),
      port,
      connector.database_name.trim(),
      connector.username.trim(),
      connector.password,
      safeSchema,
      initialCount,
    ],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to save MySQL connector metadata')
  }

  return data[0]
}

export async function deleteSocketMySQLConnector(id: number): Promise<boolean> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<{ foreign_schema: string }>({
    query: `SELECT foreign_schema FROM _socket_metadata.remote_mysql_servers WHERE id = $1`,
    parameters: [id],
  })

  if (data && data.length > 0) {
    const safeSchema = data[0].foreign_schema
    await executeQuery({
      query: `DROP SCHEMA IF EXISTS "${safeSchema}" CASCADE;`,
    })
  }

  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.remote_mysql_servers WHERE id = $1`,
    parameters: [id],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function testSocketMySQLConnector(connector: {
  host: string
  port?: number
  database_name: string
  username: string
  password: string
}): Promise<{ success: boolean; message: string; tableCount?: number }> {
  await ensureMetadataSchema()
  const port = connector.port || 3306
  const testServer = `test_mysql_${Date.now().toString(36)}`
  const testSchema = `_test_${Date.now().toString(36)}`

  try {
    await executeQuery({
      query: `
        CREATE EXTENSION IF NOT EXISTS mysql_fdw;
        CREATE SCHEMA IF NOT EXISTS "${testSchema}";
        CREATE SERVER "${testServer}"
          FOREIGN DATA WRAPPER mysql_fdw
          OPTIONS (host '${connector.host.trim().replace(/'/g, "''")}', port '${port}');
        CREATE USER MAPPING FOR postgres
          SERVER "${testServer}"
          OPTIONS (username '${connector.username.trim().replace(/'/g, "''")}', password '${connector.password.replace(/'/g, "''")}');
        IMPORT FOREIGN SCHEMA "${connector.database_name.trim().replace(/"/g, '""')}"
          FROM SERVER "${testServer}"
          INTO "${testSchema}";
      `,
    })

    const { data: tables } = await executeQuery<{ table_name: string }>({
      query: `
        SELECT table_name FROM information_schema.tables WHERE table_schema = $1
      `,
      parameters: [testSchema],
    })

    const count = tables ? tables.length : 0

    await executeQuery({
      query: `
        DROP SCHEMA IF EXISTS "${testSchema}" CASCADE;
        DROP SERVER IF EXISTS "${testServer}" CASCADE;
      `,
    })

    return {
      success: true,
      message: `Connection successful! Discovered ${count} table(s) in remote MySQL database '${connector.database_name}'.`,
      tableCount: count,
    }
  } catch (err: any) {
    await executeQuery({
      query: `
        DROP SCHEMA IF EXISTS "${testSchema}" CASCADE;
        DROP SERVER IF EXISTS "${testServer}" CASCADE;
      `,
    }).catch(() => {})

    return {
      success: false,
      message: err.message || 'Failed to connect to remote MySQL database',
    }
  }
}

export interface SocketComputeNode {
  id: number
  project_ref: string
  node_id: string
  name: string
  auth_token: string
  role: string
  cpu_cores: number
  cpu_usage_pct: number
  memory_total_mb: number
  memory_used_mb: number
  disk_free_gb: number
  os_info: string
  ip_address?: string
  status: string
  last_heartbeat: string
  created_at: string
}

export async function getSocketComputeNodes(projectRef: string): Promise<SocketComputeNode[]> {
  await ensureMetadataSchema()
  const { data, error } = await executeQuery<SocketComputeNode>({
    query: `
      SELECT id, project_ref, node_id, name, auth_token, role, cpu_cores, cpu_usage_pct,
             memory_total_mb, memory_used_mb, disk_free_gb, os_info, ip_address,
             CASE
               WHEN last_heartbeat > NOW() - INTERVAL '30 seconds' THEN 'online'
               ELSE 'offline'
             END AS status,
             last_heartbeat, created_at
      FROM _socket_metadata.compute_nodes
      WHERE project_ref = $1
      ORDER BY last_heartbeat DESC
    `,
    parameters: [projectRef],
  })
  if (error || !data) return []
  return data
}

export async function registerSocketComputeNode(
  projectRef: string,
  name: string,
  role: string = 'worker'
): Promise<SocketComputeNode> {
  await ensureMetadataSchema()
  const token = `sk_cluster_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  const nodeId = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await executeQuery<SocketComputeNode>({
    query: `
      INSERT INTO _socket_metadata.compute_nodes (
        project_ref, node_id, name, auth_token, role, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `,
    parameters: [projectRef, nodeId, name.trim(), token, role],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to register compute node')
  }

  return data[0]
}

export async function deleteSocketComputeNode(id: number): Promise<boolean> {
  await ensureMetadataSchema()
  const { error } = await executeQuery({
    query: `DELETE FROM _socket_metadata.compute_nodes WHERE id = $1`,
    parameters: [id],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function recordSocketComputeHeartbeat(heartbeat: {
  node_id: string
  name?: string
  auth_token: string
  cpu_cores?: number
  cpu_usage_pct?: number
  memory_total_mb?: number
  memory_used_mb?: number
  disk_free_gb?: number
  os_info?: string
  role?: string
  ip_address?: string
}): Promise<boolean> {
  await ensureMetadataSchema()
  const { error } = await executeQuery({
    query: `
      INSERT INTO _socket_metadata.compute_nodes (
        project_ref, node_id, name, auth_token, role, cpu_cores, cpu_usage_pct,
        memory_total_mb, memory_used_mb, disk_free_gb, os_info, ip_address, status, last_heartbeat
      )
      VALUES (
        'default', $1, COALESCE($2, 'Worker Node'), $3, COALESCE($4, 'worker'),
        COALESCE($5, 1), COALESCE($6::numeric, 0), COALESCE($7, 1024), COALESCE($8, 256),
        COALESCE($9::numeric, 10), $10, $11, 'online', NOW()
      )
      ON CONFLICT (node_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, _socket_metadata.compute_nodes.name),
        cpu_cores = EXCLUDED.cpu_cores,
        cpu_usage_pct = EXCLUDED.cpu_usage_pct,
        memory_total_mb = EXCLUDED.memory_total_mb,
        memory_used_mb = EXCLUDED.memory_used_mb,
        disk_free_gb = EXCLUDED.disk_free_gb,
        os_info = COALESCE(EXCLUDED.os_info, _socket_metadata.compute_nodes.os_info),
        ip_address = COALESCE(EXCLUDED.ip_address, _socket_metadata.compute_nodes.ip_address),
        status = 'online',
        last_heartbeat = NOW();
    `,
    parameters: [
      heartbeat.node_id,
      heartbeat.name || 'Remote Worker',
      heartbeat.auth_token,
      heartbeat.role || 'worker',
      heartbeat.cpu_cores || 1,
      heartbeat.cpu_usage_pct || 0,
      heartbeat.memory_total_mb || 1024,
      heartbeat.memory_used_mb || 256,
      heartbeat.disk_free_gb || 10,
      heartbeat.os_info || 'Linux',
      heartbeat.ip_address || '',
    ],
  })
  if (error) throw new Error(error.message)
  return true
}

export interface SocketComputeTask {
  id: number
  task_id: string
  project_ref: string
  node_id: string
  node_name?: string
  title: string
  task_type: string
  command?: string
  payload?: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
  exit_code?: number
  created_at: string
  started_at?: string
  completed_at?: string
}

export async function dispatchSocketComputeTask(
  projectRef: string,
  task: {
    node_id?: string
    title: string
    task_type: string
    command?: string
    payload?: any
  }
): Promise<SocketComputeTask> {
  await ensureMetadataSchema()
  const taskId = `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await executeQuery<SocketComputeTask>({
    query: `
      INSERT INTO _socket_metadata.compute_tasks (
        task_id, project_ref, node_id, title, task_type, command, payload, status
      )
      VALUES ($1, $2, COALESCE($3, 'any'), $4, $5, $6, $7, 'pending')
      RETURNING *
    `,
    parameters: [
      taskId,
      projectRef,
      task.node_id || 'any',
      task.title,
      task.task_type || 'bash_command',
      task.command || '',
      JSON.stringify(task.payload || {}),
    ],
  })

  if (error || !data || data.length === 0) {
    throw new Error(error?.message || 'Failed to dispatch compute task')
  }

  return data[0]
}

export async function getSocketComputeTasks(projectRef: string): Promise<SocketComputeTask[]> {
  await ensureMetadataSchema()
  const { data, error } = await executeQuery<SocketComputeTask>({
    query: `
      SELECT t.id, t.task_id, t.project_ref, t.node_id, t.title, t.task_type, t.command,
             t.payload, t.status, t.output, t.exit_code, t.created_at, t.started_at, t.completed_at,
             COALESCE(n.name, t.node_id) as node_name
      FROM _socket_metadata.compute_tasks t
      LEFT JOIN _socket_metadata.compute_nodes n ON t.node_id = n.node_id
      WHERE t.project_ref = $1
      ORDER BY t.id DESC
      LIMIT 100
    `,
    parameters: [projectRef],
  })
  if (error || !data) return []
  return data
}

export async function pullPendingComputeTasks(nodeId: string): Promise<SocketComputeTask[]> {
  await ensureMetadataSchema()
  const { data } = await executeQuery<SocketComputeTask>({
    query: `
      UPDATE _socket_metadata.compute_tasks
      SET status = 'running', started_at = NOW(), node_id = $1
      WHERE id IN (
        SELECT id FROM _socket_metadata.compute_tasks
        WHERE (node_id = $1 OR node_id = 'any') AND status = 'pending'
        ORDER BY id ASC
        LIMIT 5
      )
      RETURNING *
    `,
    parameters: [nodeId],
  })
  return data || []
}

export async function completeSocketComputeTask(
  taskId: string,
  result: {
    status: 'completed' | 'failed'
    output: string
    exit_code?: number
  }
): Promise<boolean> {
  await ensureMetadataSchema()
  const { error } = await executeQuery({
    query: `
      UPDATE _socket_metadata.compute_tasks
      SET status = $2, output = $3, exit_code = $4, completed_at = NOW()
      WHERE task_id = $1
    `,
    parameters: [taskId, result.status, result.output, result.exit_code ?? 0],
  })
  if (error) throw new Error(error.message)
  return true
}


