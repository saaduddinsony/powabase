import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'

import { TeamSettings } from '@/components/interfaces/Organization/TeamSettings/TeamSettings'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import OrganizationLayout from '@/components/layouts/OrganizationLayout'
import OrganizationSettingsLayout from '@/components/layouts/ProjectLayout/OrganizationSettingsLayout'
import type { NextPageWithLayout } from '@/types'

const OrgTeamSettingsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="default">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Team</PageHeaderTitle>
            <PageHeaderDescription>
              Manage team members, invitations, and role permissions
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="default">
        <TeamSettings />
      </PageContainer>
    </>
  )
}

OrgTeamSettingsPage.getLayout = (page) => (
  <DefaultLayout>
    <OrganizationLayout title="Team">
      <OrganizationSettingsLayout>{page}</OrganizationSettingsLayout>
    </OrganizationLayout>
  </DefaultLayout>
)

export default OrgTeamSettingsPage
