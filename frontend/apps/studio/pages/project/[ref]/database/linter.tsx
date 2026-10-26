import { useParams } from 'common'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'

import LintPageTabs from '@/components/interfaces/Linter/LintPageTabs'
import { LINTER_LEVELS } from '@/components/interfaces/Linter/Linter.constants'
import LinterDataGrid from '@/components/interfaces/Linter/LinterDataGrid'
import LinterFilters from '@/components/interfaces/Linter/LinterFilters'
import { LinterPageFooter } from '@/components/interfaces/Linter/LinterPageFooter'
import DatabaseLayout from '@/components/layouts/DatabaseLayout/DatabaseLayout'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import { useProjectLintsQuery } from '@/data/lint/lint-query'
import type { NextPageWithLayout } from '@/types'

const DatabaseLinterPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const router = useRouter()

  const { preset, id } = router.query
  const defaultTab =
    preset === 'WARN'
      ? LINTER_LEVELS.WARN
      : preset === 'INFO'
        ? LINTER_LEVELS.INFO
        : LINTER_LEVELS.ERROR

  const [currentTab, setCurrentTab] = useState<LINTER_LEVELS>(defaultTab)

  const [filters, setFilters] = useState<{ level: LINTER_LEVELS; filters: string[] }[]>([
    { level: LINTER_LEVELS.ERROR, filters: [] },
    { level: LINTER_LEVELS.WARN, filters: [] },
    { level: LINTER_LEVELS.INFO, filters: [] },
  ])

  const {
    data: lints = [],
    isLoading,
    isRefetching,
    refetch,
  } = useProjectLintsQuery({
    projectRef: ref,
  })

  const selectedLint = useMemo(() => {
    if (!id) return null
    return lints.find((lint) => lint.cache_key === id) || null
  }, [id, lints])

  const activeTabLints = useMemo(() => {
    return lints.filter((lint) => lint.level === currentTab)
  }, [lints, currentTab])

  const filterOptions = useMemo(() => {
    const uniqueNames = Array.from(new Set(activeTabLints.map((l) => l.name)))
    return uniqueNames.map((name) => ({ name, value: name }))
  }, [activeTabLints])

  const currentLevelFilters = filters.find((f) => f.level === currentTab)?.filters || []

  const filteredLints = useMemo(() => {
    if (currentLevelFilters.length === 0) return activeTabLints
    return activeTabLints.filter((lint) => currentLevelFilters.includes(lint.name))
  }, [activeTabLints, currentLevelFilters])

  return (
    <div className="flex flex-col h-full w-full">
      <PageHeader size="large" className="pb-0 border-b-0">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Security & Performance Advisor</PageHeaderTitle>
            <PageHeaderDescription>
              Analyze your database for security risks, missing Row Level Security policies, and performance bottlenecks
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>

      <div className="px-6 pt-4">
        <LintPageTabs
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          isLoading={isLoading}
          activeLints={lints}
        />
      </div>

      <LinterFilters
        filterOptions={filterOptions}
        activeLints={lints}
        filteredLints={filteredLints}
        currentTab={currentTab}
        filters={filters}
        isLoading={isLoading || isRefetching}
        setFilters={setFilters}
        onClickRefresh={() => refetch()}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <LinterDataGrid
          isLoading={isLoading}
          filteredLints={filteredLints}
          selectedLint={selectedLint}
          currentTab={currentTab}
        />
      </div>

      <LinterPageFooter
        isLoading={isLoading}
        isRefetching={isRefetching}
        refetch={() => refetch()}
        hideDbInspectCTA
      />
    </div>
  )
}

DatabaseLinterPage.getLayout = (page) => (
  <DefaultLayout>
    <DatabaseLayout title="Advisors & Linter">{page}</DatabaseLayout>
  </DefaultLayout>
)

export default DatabaseLinterPage
