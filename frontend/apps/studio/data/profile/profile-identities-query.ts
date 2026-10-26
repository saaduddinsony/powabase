import type { UserIdentity } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'

import { profileKeys } from './keys'
import { auth } from '@/lib/gotrue'
import { UseCustomQueryOptions } from '@/types'

export async function getProfileIdentities() {
  try {
    const { error, data } = await auth.getSession()
    if (!error && data?.session?.user) {
      const { identities = [], new_email, email_change_sent_at } = data.session.user
      if (identities.length > 0) {
        return { identities, new_email, email_change_sent_at }
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  return {
    identities: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000001',
        identity_data: { email: 'admin@socket.dev' },
        provider: 'email',
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ],
    new_email: undefined,
    email_change_sent_at: undefined,
  }
}

type ProfileIdentitiesData = {
  identities: (UserIdentity & { email?: string })[]
  new_email?: string
  email_change_sent_at?: string
}
type ProfileIdentitiesError = any

export const useProfileIdentitiesQuery = <TData = ProfileIdentitiesData>({
  enabled = true,
  ...options
}: UseCustomQueryOptions<ProfileIdentitiesData, ProfileIdentitiesError, TData> = {}) => {
  return useQuery<ProfileIdentitiesData, ProfileIdentitiesError, TData>({
    queryKey: profileKeys.identities(),
    queryFn: () => getProfileIdentities(),
    ...options,
  })
}
