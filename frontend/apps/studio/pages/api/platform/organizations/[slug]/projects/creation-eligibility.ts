import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return res.status(200).json({
        entitled: true,
        first_project_free: true,
        allowed_tiers: ['nano', 'micro', 'small', 'medium', 'large', 'xlarge'],
      })
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}
