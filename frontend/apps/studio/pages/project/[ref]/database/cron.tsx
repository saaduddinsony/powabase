import { CronjobsTab } from '@/components/interfaces/Integrations/CronJobs/CronJobsTab'
import DatabaseLayout from '@/components/layouts/DatabaseLayout/DatabaseLayout'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import type { NextPageWithLayout } from '@/types'

const DatabaseCronPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col h-full w-full">
      <CronjobsTab />
    </div>
  )
}

DatabaseCronPage.getLayout = (page) => (
  <DefaultLayout>
    <DatabaseLayout title="Cron Jobs">{page}</DatabaseLayout>
  </DefaultLayout>
)

export default DatabaseCronPage
