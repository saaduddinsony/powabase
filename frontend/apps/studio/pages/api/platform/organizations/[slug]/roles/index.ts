import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  // Return standard roles compatible with Supabase Studio V2
  return res.status(200).json({
    org_scoped_roles: [
      { id: 1, name: 'Owner', description: 'Full access to organization settings, billing, and all projects', projects: [] },
      { id: 2, name: 'Administrator', description: 'Full access to all project resources and member management', projects: [] },
      { id: 3, name: 'Developer', description: 'Full access to database schemas, SQL editor, and AI workbench', projects: [] },
      { id: 4, name: 'Read-only', description: 'View access to database contents, tables, and AI logs', projects: [] },
    ],
    project_scoped_roles: [
      { id: 101, name: 'Project Administrator', description: 'Administrator privileges restricted to specific projects', projects: [] },
      { id: 102, name: 'Project Developer', description: 'Developer privileges restricted to specific projects', projects: [] },
      { id: 103, name: 'Project Read-only', description: 'Read-only access restricted to specific projects', projects: [] },
    ],
  })
}
