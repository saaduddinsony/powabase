import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'

import { AccountIdentities } from '@/components/interfaces/Account/Preferences/AccountIdentities'
import { DashboardSettings } from '@/components/interfaces/Account/Preferences/DashboardSettings'
import { HotkeySettings } from '@/components/interfaces/Account/Preferences/HotkeySettings'
import { ProfileInformation } from '@/components/interfaces/Account/Preferences/ProfileInformation'
import { ThemeSettings } from '@/components/interfaces/Account/Preferences/ThemeSettings'
import AccountLayout from '@/components/layouts/AccountLayout/AccountLayout'
import { AppLayout } from '@/components/layouts/AppLayout/AppLayout'
import { DefaultLayout } from '@/components/layouts/DefaultLayout'
import type { NextPageWithLayout } from '@/types'

const User: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="small">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Preferences</PageHeaderTitle>
            <PageHeaderDescription>
              Manage your account profile, connections, and dashboard experience.
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="small" className="space-y-8">
        <ProfileInformation />
        <AccountIdentities />
        <ThemeSettings />
        <HotkeySettings />
        <DashboardSettings />
      </PageContainer>
    </>
  )
}

User.getLayout = (page) => (
  <AppLayout>
    <DefaultLayout headerTitle="Account">
      <AccountLayout title="Preferences">{page}</AccountLayout>
    </DefaultLayout>
  </AppLayout>
)

export default User
