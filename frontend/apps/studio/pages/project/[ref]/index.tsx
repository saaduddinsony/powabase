import { SupabaseProjectOverview } from '@/components/interfaces/ProjectHome/SupabaseProjectOverview'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import { ProjectLayoutWithAuth } from '@/components/layouts/ProjectLayout'
import type { NextPageWithLayout } from '@/types'

const HomePage: NextPageWithLayout = () => {
  return <SupabaseProjectOverview />
}

HomePage.getLayout = (page) => (
  <DefaultLayout>
    <ProjectLayoutWithAuth>{page}</ProjectLayoutWithAuth>
  </DefaultLayout>
)

export default HomePage
