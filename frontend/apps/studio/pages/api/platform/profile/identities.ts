import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import { getSocketUserProfile } from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  try {
    const profile = await getSocketUserProfile()
    return res.status(200).json({
      identities: [
        {
          id: profile.gotrue_id || '00000000-0000-0000-0000-000000000001',
          user_id: profile.gotrue_id || '00000000-0000-0000-0000-000000000001',
          identity_data: { email: profile.primary_email },
          provider: 'email',
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      new_email: undefined,
      email_change_sent_at: undefined,
    })
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to get identities' } })
  }
}
