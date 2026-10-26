import { QueuesSettings } from '@/components/interfaces/Integrations/Queues/QueuesSettings'
import DatabaseLayout from '@/components/layouts/DatabaseLayout/DatabaseLayout'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import type { NextPageWithLayout } from '@/types'

const DatabaseQueuesPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col h-full w-full">
      <QueuesSettings />
    </div>
  )
}

DatabaseQueuesPage.getLayout = (page) => (
  <DefaultLayout>
    <DatabaseLayout title="Queues">{page}</DatabaseLayout>
  </DefaultLayout>
)

export default DatabaseQueuesPage
