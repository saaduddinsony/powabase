import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import { executeQuery } from '@/lib/api/self-hosted/metadata'
import { getSocketBranchByIdOrRef } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const branchIdOrRef = req.query.branch_id_or_ref as string
  try {
    const branch = await getSocketBranchByIdOrRef(branchIdOrRef)
    if (!branch || !branch.db_schema || branch.db_schema === 'public') {
      res.setHeader('Content-Type', 'text/plain')
      return res.status(200).send('')
    }

    const { data: branchTables } = await executeQuery<{ table_name: string }>({
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      `,
      parameters: [branch.db_schema],
    })

    const { data: publicTables } = await executeQuery<{ table_name: string }>({
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `,
    })

    const publicNames = new Set((publicTables || []).map((t) => t.table_name))
    const branchNames = new Set((branchTables || []).map((t) => t.table_name))

    const addedTables = [...branchNames].filter((t) => !publicNames.has(t))
    const removedTables = [...publicNames].filter((t) => !branchNames.has(t))

    const diffLines: string[] = []

    if (addedTables.length > 0) {
      diffLines.push(`-- Tables added in branch ${branch.name}:`)
      for (const t of addedTables) {
        diffLines.push(`-- CREATE TABLE public.${t} (...);`)
      }
    }

    if (removedTables.length > 0) {
      diffLines.push(`-- Tables removed in branch ${branch.name}:`)
      for (const t of removedTables) {
        diffLines.push(`-- DROP TABLE public.${t};`)
      }
    }

    const diffOutput = diffLines.join('\n')
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(diffOutput)
  } catch (error: any) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send('')
  }
}
