import { useParams } from 'common'
import dayjs from 'dayjs'
import { ArrowRight, BookOpen, ChevronDown, Clock, Filter, Info } from 'lucide-react'
import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import type { NextPageWithLayout } from '@/types'

const PostgrestObservabilityPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [selectedRange, setSelectedRange] = useState('60m')
  const now = dayjs()
  const start = now.subtract(1, 'hour')

  return (
    <div className="flex flex-col grow gap-6 px-5 py-6 mx-auto w-full max-w-7xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">Data API</h1>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://supabase.com/docs/guides/api"
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

      {/* Filter Row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-dashed border-default rounded-md hover:bg-surface-200 text-foreground-lighter hover:text-foreground"
        >
          <Filter size={12} />
          <span>Add filter</span>
        </button>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Total Requests</h3>
          <div className="h-44 flex flex-col items-center justify-center text-foreground-lighter">
            <p className="text-xs font-medium text-foreground m-0">No data to show</p>
            <p className="text-[11px] text-foreground-lighter mt-1 m-0">
              It may take up to 24 hours for data to refresh
            </p>
          </div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Response Errors</h3>
          <div className="h-44 flex flex-col items-center justify-center text-foreground-lighter">
            <p className="text-xs font-medium text-foreground m-0">No data to show</p>
            <p className="text-[11px] text-foreground-lighter mt-1 m-0">
              It may take up to 24 hours for data to refresh
            </p>
          </div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Response Speed</h3>
          <div className="h-44 flex flex-col items-center justify-center text-foreground-lighter">
            <p className="text-xs font-medium text-foreground m-0">No data to show</p>
            <p className="text-[11px] text-foreground-lighter mt-1 m-0">
              It may take up to 24 hours for data to refresh
            </p>
          </div>
        </div>

        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <h3 className="text-foreground-lighter text-sm font-medium m-0 mb-2">Network Traffic</h3>
          <div className="text-xs text-foreground-lighter uppercase font-medium mt-3">Ingress</div>
          <div className="text-2xl font-semibold text-foreground font-mono mt-0.5">0 MB</div>
          <div className="h-32 flex flex-col items-center justify-center text-foreground-lighter">
            <p className="text-xs font-medium text-foreground m-0">No data to show</p>
            <p className="text-[11px] text-foreground-lighter mt-1 m-0">
              It may take up to 24 hours for data to refresh
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

PostgrestObservabilityPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="Data API">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default PostgrestObservabilityPage
