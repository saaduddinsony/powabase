import fs from 'fs'
import os from 'os'
import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { executeQuery } from '@/lib/api/self-hosted/query'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const getStats = () => {
        const cpus = os.cpus()
        let idle = 0
        let total = 0
        for (const cpu of cpus) {
          for (const type in cpu.times) {
            total += (cpu.times as any)[type]
          }
          idle += cpu.times.idle
        }
        return { idle, total }
      }

      const s1 = getStats()
      setTimeout(() => {
        try {
          const s2 = getStats()
          const idleDelta = s2.idle - s1.idle
          const totalDelta = s2.total - s1.total
          const pct = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0
          resolve(Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10)
        } catch {
          resolve(0)
        }
      }, 120)
    } catch {
      resolve(0)
    }
  })
}

function getMemoryStats() {
  let memTotal = os.totalmem()
  let memFree = os.freemem()
  let memAvailable = memFree
  let buffers = 0
  let cached = 0

  try {
    if (fs.existsSync('/proc/meminfo')) {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8')
      const lines = meminfo.split('\n')
      for (const line of lines) {
        const [key, val] = line.split(':').map((s) => s.trim())
        if (key === 'MemTotal' && val) memTotal = parseInt(val) * 1024
        if (key === 'MemFree' && val) memFree = parseInt(val) * 1024
        if (key === 'MemAvailable' && val) memAvailable = parseInt(val) * 1024
        if (key === 'Buffers' && val) buffers = parseInt(val) * 1024
        if (key === 'Cached' && val) cached = parseInt(val) * 1024
      }
    }
  } catch (err) {
    // fallback to os stats
  }

  const memUsed = Math.max(0, memTotal - memAvailable)
  const usedPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0

  return {
    totalBytes: memTotal,
    usedBytes: memUsed,
    freeBytes: memAvailable,
    rawFreeBytes: memFree,
    buffersBytes: buffers,
    cachedBytes: cached,
    usedPercent: Math.round(usedPercent * 10) / 10,
    totalFormatted: formatBytes(memTotal),
    usedFormatted: formatBytes(memUsed),
    freeFormatted: formatBytes(memAvailable),
  }
}

function getDiskStats() {
  try {
    const statfs = fs.statfsSync('/')
    const totalBytes = statfs.blocks * statfs.bsize
    const freeBytes = statfs.bfree * statfs.bsize
    const availBytes = statfs.bavail * statfs.bsize
    const usedBytes = Math.max(0, totalBytes - freeBytes)
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

    return {
      totalBytes,
      usedBytes,
      freeBytes: availBytes,
      usedPercent: Math.round(usedPercent * 10) / 10,
      totalFormatted: formatBytes(totalBytes),
      usedFormatted: formatBytes(usedBytes),
      freeFormatted: formatBytes(availBytes),
      mount: '/',
      filesystem: 'NVMe / SSD',
    }
  } catch {
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usedPercent: 0,
      totalFormatted: 'N/A',
      usedFormatted: 'N/A',
      freeFormatted: 'N/A',
      mount: '/',
      filesystem: 'Unknown',
    }
  }
}

import net from 'net'

interface ServiceHealthResult {
  name: string
  role: string
  category: string
  port: number
  description: string
  status: 'healthy' | 'unhealthy'
  latencyMs: number
  errorMessage?: string
}

function checkTcpService(
  name: string,
  role: string,
  category: string,
  host: string,
  port: number,
  description: string
): Promise<ServiceHealthResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    socket.setTimeout(1500)

    let settled = false
    const finish = (status: 'healthy' | 'unhealthy', errorMsg?: string) => {
      if (settled) return
      settled = true
      socket.destroy()
      const latencyMs = Date.now() - start
      resolve({
        name,
        role,
        category,
        port,
        description,
        status,
        latencyMs: status === 'healthy' ? Math.max(1, latencyMs) : 0,
        errorMessage: errorMsg,
      })
    }

    socket.connect(port, host, () => {
      finish('healthy')
    })

    socket.on('error', (err) => {
      finish('unhealthy', err.message)
    })

    socket.on('timeout', () => {
      finish('unhealthy', 'Connection timed out (1500ms)')
    })
  })
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  try {
    const [cpuPercent] = await Promise.all([getCpuUsage()])
    const memory = getMemoryStats()
    const disk = getDiskStats()

    const cpus = os.cpus()
    const loadAvg = os.loadavg()
    const uptime = os.uptime()

    // Query Postgres database statistics directly from pg_meta
    let databaseStats: {
      status: string
      size: string
      sizeBytes: number
      activeConnections: number
      maxConnections: number
      cacheHitRatio: number
      version: string
    } | null = null

    try {
      const dbResult = await executeQuery<{
        db_size: string
        db_size_bytes: number
        active_connections: number
        max_connections: number
        cache_hit_ratio: number
        pg_version: string
      }>({
        query: `SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size, 
          pg_database_size(current_database()) as db_size_bytes, 
          (SELECT count(*)::int FROM pg_stat_activity) as active_connections, 
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections, 
          round((sum(blks_hit)*100.0 / nullif(sum(blks_hit+blks_read),0))::numeric, 2)::float as cache_hit_ratio, 
          split_part(version(), ' on ', 1) as pg_version 
        FROM pg_stat_database GROUP BY 1, 2;`,
        readOnly: true,
      })

      if (dbResult.data && dbResult.data.length > 0) {
        const row = dbResult.data[0]
        databaseStats = {
          status: 'healthy',
          size: row.db_size || 'N/A',
          sizeBytes: Number(row.db_size_bytes) || 0,
          activeConnections: Number(row.active_connections) || 0,
          maxConnections: Number(row.max_connections) || 100,
          cacheHitRatio: Number(row.cache_hit_ratio) || 0,
          version: row.pg_version || 'PostgreSQL 15',
        }
      }
    } catch {
      databaseStats = null
    }

    // Check Socket stack services via real TCP connections to internal containers
    const servicesToCheck = [
      {
        name: 'PostgreSQL Database',
        role: 'Primary SQL Engine & Vector Store',
        category: 'Data Storage',
        host: 'db',
        port: 5432,
        description: 'Postgres 15 relational engine with pgvector, pg_graphql, and cron support',
      },
      {
        name: 'Kong API Gateway',
        role: 'Unified Router & Reverse Proxy',
        category: 'Networking',
        host: 'kong',
        port: 8000,
        description: 'API gateway handling routing, SSL termination, and rate limiting',
      },
      {
        name: 'GoTrue Auth',
        role: 'Identity & Authentication',
        category: 'Security & Identity',
        host: 'auth',
        port: 9999,
        description: 'User management, JWT issuance, OAuth providers, and MFA',
      },
      {
        name: 'PostgREST API',
        role: 'Instant RESTful Engine',
        category: 'API Layer',
        host: 'rest',
        port: 3000,
        description: 'Translates database schema directly into high-throughput REST endpoints',
      },
      {
        name: 'Storage Engine',
        role: 'S3-Compatible Object Storage',
        category: 'Object Storage',
        host: 'storage',
        port: 5000,
        description: 'Bucket management, asset upload, and image transformation proxy',
      },
      {
        name: 'Postgres Meta',
        role: 'Database Management API',
        category: 'Management Plane',
        host: 'meta',
        port: 8080,
        description: 'Inspects schemas, executes queries, and manages table migrations',
      },
      {
        name: 'Realtime Engine',
        role: 'WebSockets & CDC Broadcast',
        category: 'Realtime & Events',
        host: 'realtime',
        port: 4000,
        description: 'Broadcasts database changes over WebSockets with Presence and Broadcast',
      },
      {
        name: 'Project API',
        role: 'Management & Control Plane',
        category: 'Control Plane',
        host: 'project-api',
        port: 5000,
        description: 'Platform management daemon and project orchestration controller',
      },
      {
        name: 'Socket Studio',
        role: 'Developer Web Dashboard',
        category: 'Developer Console',
        host: 'localhost',
        port: 3001,
        description: 'Unified management console and developer cockpit for Socket',
      },
      {
        name: 'Redis Cache',
        role: 'In-Memory Cache & Lock Store',
        category: 'In-Memory Store',
        host: 'redis',
        port: 6379,
        description: 'In-memory data store for caching, queues, and distributed locks',
      },
    ]

    const services = await Promise.all(
      servicesToCheck.map((s) =>
        checkTcpService(s.name, s.role, s.category, s.host, s.port, s.description)
      )
    )

    const host = {
      hostname: 'backend.freightsolution.xyz',
      platform: os.platform() === 'linux' ? 'Linux' : os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion: process.version,
      serverTime: new Date().toISOString(),
      deploymentType: 'Dedicated Bare-Metal / VPS',
      region: 'Southeast Asia (Singapore)',
      regionCode: 'ap-southeast-1',
      city: 'Singapore',
      country: 'Singapore',
      countryCode: 'SG',
      coordinates: [103.8, 1.37],
    }

    const cpu = {
      cores: cpus.length || 2,
      model: cpus[0]?.model || 'Ampere ARM64 Processor',
      speedMhz: cpus[0]?.speed || 3000,
      usagePercent: cpuPercent,
      loadAverage: loadAvg.map((l) => Math.round(l * 100) / 100),
    }

    return res.status(200).json({
      host,
      cpu,
      memory,
      disk,
      database: databaseStats,
      services,
    })
  } catch (error: any) {
    console.error('Failed to get server resources:', error)
    return res.status(500).json({ error: { message: error.message || 'Failed to retrieve server resources' } })
  }
}
