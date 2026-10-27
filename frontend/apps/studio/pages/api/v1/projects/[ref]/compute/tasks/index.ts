import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  dispatchSocketComputeTask,
  getSocketComputeTasks,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ref } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'

  if (req.method === 'GET') {
    try {
      const tasks = await getSocketComputeTasks(projectRef)
      return res.status(200).json(tasks)
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message || 'Failed to get tasks' } })
    }
  }

  if (req.method === 'POST') {
    try {
      const { node_id, title, task_type, command, payload } = req.body || {}

      if (!title) {
        return res.status(400).json({ error: { message: 'title is required' } })
      }

      const task = await dispatchSocketComputeTask(projectRef, {
        node_id: node_id || 'any',
        title,
        task_type: task_type || 'bash_command',
        command: command || '',
        payload: payload || {},
      })

      return res.status(201).json(task)
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to dispatch task' } })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
}
