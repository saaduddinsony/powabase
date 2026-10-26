import { ReactElement } from 'react'
import { useParams } from 'common'
import { INTEGRATIONS } from '@/components/interfaces/Integrations/Landing/Integrations.constants'
import { IntegrationOverviewTabWrapper } from '@/components/interfaces/Integrations/Integration/IntegrationOverviewTabWrapper'
import { ProjectIntegrationsLayout } from '@/components/layouts/ProjectIntegrationsLayout'
import type { NextPageWithLayout } from 'types'

const IntegrationDetailPage: NextPageWithLayout = () => {
  const { id } = useParams()
  const integration = INTEGRATIONS.find((i) => i.id === id)

  if (integration?.navigate) {
    const Component = integration.navigate({ id, pageId: 'overview', childId: undefined })
    if (Component) return <Component />
  }

  return <IntegrationOverviewTabWrapper />
}

IntegrationDetailPage.getLayout = (page: ReactElement) => (
  <ProjectIntegrationsLayout>{page}</ProjectIntegrationsLayout>
)

export default IntegrationDetailPage
