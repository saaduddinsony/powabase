import { useParams } from 'common'
import { parseAsString, useQueryStates } from 'nuqs'
import { useMemo } from 'react'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import { QueryPerformance } from '@/components/interfaces/QueryPerformance/QueryPerformance'
import { useQueryPerformanceQuery } from '@/components/interfaces/QueryPerformance/useQueryPerformanceQuery'
import { PRESET_CONFIG } from '@/components/interfaces/Reports/Reports.constants'
import { Presets } from '@/components/interfaces/Reports/Reports.types'
import useDbQuery from '@/hooks/analytics/useDbQuery'
import type { NextPageWithLayout } from '@/types'
import type { QueryPerformanceSort } from '@/components/interfaces/QueryPerformance/QueryPerformance.types'

const QueryPerformancePage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [{ preset: urlPreset, search: searchQuery, order, sort }] = useQueryStates({
    sort: parseAsString,
    search: parseAsString.withDefault(''),
    order: parseAsString,
    preset: parseAsString.withDefault('unified'),
  })

  const presetConfig = PRESET_CONFIG[Presets.QUERY_PERFORMANCE]

  const queryHitRate = useDbQuery({
    sql: presetConfig.queries.queryHitRate.sql([]),
  })

  const queryMetrics = useDbQuery({
    sql: presetConfig.queries.queryMetrics.sql([], '', ''),
  })

  const orderBy = useMemo(() => {
    return sort ? ({ column: sort as any, order: (order as any) || 'desc' } as QueryPerformanceSort) : undefined
  }, [sort, order])

  const queryPerformanceQuery = useQueryPerformanceQuery({
    searchQuery,
    orderBy,
    preset: (urlPreset as any) || 'unified',
    roles: [],
  })

  return (
    <div className="flex flex-col grow gap-4 px-5 py-6 mx-auto w-full max-w-7xl">
      <QueryPerformance
        queryHitRate={queryHitRate}
        queryPerformanceQuery={queryPerformanceQuery}
        queryMetrics={queryMetrics}
      />
    </div>
  )
}

QueryPerformancePage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Query Performance">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default QueryPerformancePage
