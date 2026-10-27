import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { completeSocketComputeTask } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { id } = req.query
  const taskId = Array.isArray(id) ? id[0] : id

  if (!taskId) {
    return res.status(400).json({ error: { message: 'task ID is required' } })
  }

  const { status, output, exit_code } = req.body || {}

  try {
    await completeSocketComputeTask(taskId, {
      status: status === 'failed' ? 'failed' : 'completed',
      output: typeof output === 'string' ? output : JSON.stringify(output || ''),
      exit_code: typeof exit_code === 'number' ? exit_code : 0,
    })

    return res.status(200).json({ success: true, message: 'Task marked completed' })
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Failed to update task result' } })
  }
}
