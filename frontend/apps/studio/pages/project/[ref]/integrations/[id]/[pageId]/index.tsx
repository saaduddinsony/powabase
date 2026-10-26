import { ReactElement } from 'react'
import { useParams } from 'common'
import { INTEGRATIONS } from '@/components/interfaces/Integrations/Landing/Integrations.constants'
import { IntegrationOverviewTabWrapper } from '@/components/interfaces/Integrations/Integration/IntegrationOverviewTabWrapper'
import { ProjectIntegrationsLayout } from '@/components/layouts/ProjectIntegrationsLayout'
import type { NextPageWithLayout } from 'types'

const IntegrationSubPage: NextPageWithLayout = () => {
  const { id, pageId } = useParams()
  const integration = INTEGRATIONS.find((i) => i.id === id)

  if (integration?.navigate) {
    const Component = integration.navigate({ id, pageId, childId: undefined })
    if (Component) return <Component />
  }

  return <IntegrationOverviewTabWrapper />
}

IntegrationSubPage.getLayout = (page: ReactElement) => (
  <ProjectIntegrationsLayout>{page}</ProjectIntegrationsLayout>
)

export default IntegrationSubPage
