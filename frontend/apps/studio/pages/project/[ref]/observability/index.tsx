import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import { ObservabilityOverview } from '@/components/interfaces/Observability/ObservabilityOverview'
import type { NextPageWithLayout } from '@/types'

const ObservabilityOverviewPage: NextPageWithLayout = () => {
  return <ObservabilityOverview />
}

ObservabilityOverviewPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Overview">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default ObservabilityOverviewPage
