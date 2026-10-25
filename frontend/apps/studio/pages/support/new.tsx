import { SupportFormPage } from '@/components/interfaces/Support/SupportFormPage'
import { AppLayout } from '@/components/layouts/AppLayout/AppLayout'
import { DefaultLayout } from '@/components/layouts/DefaultLayout'
import { withAuth } from '@/hooks/misc/withAuth'
import type { NextPageWithLayout } from '@/types'

import Head from 'next/head'

const SupportPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Support | Socket</title>
      </Head>
      <SupportFormPage />
    </>
  )
}

SupportPage.getLayout = (page) => (
  <AppLayout>
    <DefaultLayout hideMobileMenu headerTitle="Support">{page}</DefaultLayout>
  </AppLayout>
)

export default withAuth(SupportPage, { useHighestAAL: false })
