import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  pullPendingComputeTasks,
  recordSocketComputeHeartbeat,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const {
    node_id,
    name,
    auth_token,
    cpu_cores,
    cpu_usage_pct,
    memory_total_mb,
    memory_used_mb,
    disk_free_gb,
    os_info,
    role,
  } = req.body || {}

  if (!node_id || !auth_token) {
    return res.status(400).json({ error: { message: 'node_id and auth_token are required' } })
  }

  try {
    const forwarded = req.headers['x-forwarded-for']
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress

    await recordSocketComputeHeartbeat({
      node_id,
      name,
      auth_token,
      cpu_cores: cpu_cores ? parseInt(cpu_cores, 10) : 1,
      cpu_usage_pct: cpu_usage_pct ? parseFloat(cpu_usage_pct) : 0,
      memory_total_mb: memory_total_mb ? parseInt(memory_total_mb, 10) : 1024,
      memory_used_mb: memory_used_mb ? parseInt(memory_used_mb, 10) : 256,
      disk_free_gb: disk_free_gb ? parseFloat(disk_free_gb) : 10,
      os_info: os_info || 'Linux',
      role: role || 'worker',
      ip_address: ip || '',
    })

    const tasks = await pullPendingComputeTasks(node_id)

    return res.status(200).json({
      success: true,
      message: 'Heartbeat acknowledged',
      timestamp: new Date().toISOString(),
      tasks,
    })
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Heartbeat processing failed' } })
  }
}
