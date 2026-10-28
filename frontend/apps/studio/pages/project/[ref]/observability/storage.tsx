import { useParams } from 'common'
import dayjs from 'dayjs'
import { ArrowRight, BookOpen, ChevronDown, Clock } from 'lucide-react'
import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import type { NextPageWithLayout } from '@/types'

const StorageObservabilityPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [selectedRange, setSelectedRange] = useState('60m')
  const now = dayjs()
  const start = now.subtract(1, 'hour')

  return (
    <div className="flex flex-col grow gap-6 px-5 py-6 mx-auto w-full max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">Storage</h1>

        <div className="flex flex-wrap items-center gap-2">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://supabase.com/docs/guides/storage"
            className="relative inline-flex items-center space-x-2 border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs px-2.5 py-1 h-[26px] rounded-md transition-colors"
          >
            <BookOpen size={14} className="text-foreground-lighter" />
            <span>Docs</span>
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative inline-flex items-center space-x-2 border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs px-2.5 py-1 h-[26px] rounded-md transition-colors"
              >
                <Clock size={12} className="text-foreground-lighter" />
                <span>Last 60 minutes</span>
                <ChevronDown size={12} className="text-foreground-lighter" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setSelectedRange('60m')}>Last 60 minutes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedRange('24h')}>Last 24 hours</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedRange('7d')}>Last 7 days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-x-2 text-xs text-foreground-light font-mono pl-1">
            <p className="m-0">{start.format('MMM D, h:mma')}</p>
            <ArrowRight size={12} className="text-foreground-lighter" />
            <p className="m-0">{now.format('MMM D, h:mma')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Total Requests</h3>
          <div className="text-2xl font-semibold text-foreground font-mono">4</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5">
            {now.format('MMM D, YYYY, hh:mma')}
          </div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Cache Hit Rate</h3>
          <div className="text-2xl font-semibold text-foreground font-mono">98.4%</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5">Edge CDN Cached</div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Response Speed</h3>
          <div className="text-2xl font-semibold text-foreground font-mono">18.6 ms</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5">Average latency</div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Network Traffic</h3>
          <div className="text-xs text-foreground-lighter uppercase font-medium mt-3">Ingress</div>
          <div className="text-2xl font-semibold text-foreground font-mono mt-0.5">0.14 MB</div>
        </div>
      </div>
    </div>
  )
}

StorageObservabilityPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Storage">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default StorageObservabilityPage
