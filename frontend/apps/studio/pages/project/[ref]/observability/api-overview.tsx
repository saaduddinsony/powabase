import { useParams } from 'common'
import dayjs from 'dayjs'
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  Filter,
  Globe,
  Info,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger, cn } from 'ui'

import DefaultLayout from '@/components/layouts/DefaultLayout'
import ObservabilityLayout from '@/components/layouts/ObservabilityLayout/ObservabilityLayout'
import type { NextPageWithLayout } from '@/types'

const ApiOverviewPage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  const [selectedRange, setSelectedRange] = useState('60m')
  const [selectedFilter, setSelectedFilter] = useState('All Requests')

  const now = dayjs()
  const start = now.subtract(1, 'hour')

  return (
    <div className="flex flex-col grow gap-6 px-5 py-6 mx-auto w-full max-w-7xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0">API Gateway</h1>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Docs */}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://supabase.com/docs/guides/platform/metrics#api-gateway"
            className="relative inline-flex items-center space-x-2 border border-default bg-surface-100 hover:bg-surface-200 text-foreground text-xs px-2.5 py-1 h-[26px] rounded-md transition-colors"
          >
            <BookOpen size={14} className="text-foreground-lighter" />
            <span>Docs</span>
          </a>

          {/* Time range */}
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

          {/* Date interval */}
          <div className="flex items-center gap-x-2 text-xs text-foreground-light font-mono pl-1">
            <p className="m-0">{start.format('MMM D, h:mma')}</p>
            <ArrowRight size={12} className="text-foreground-lighter" />
            <p className="m-0">{now.format('MMM D, h:mma')}</p>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-default rounded-md bg-surface-100 hover:bg-surface-200 text-foreground"
            >
              <span>{selectedFilter}</span>
              <ChevronDown size={12} className="text-foreground-lighter" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => setSelectedFilter('All Requests')}>All Requests</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedFilter('Errors Only')}>Errors Only</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-dashed border-default rounded-md hover:bg-surface-200 text-foreground-lighter hover:text-foreground"
        >
          <Filter size={12} />
          <span>Add filter</span>
        </button>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests by Geography */}
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground-lighter text-sm font-medium m-0">Requests by Geography</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-foreground-lighter cursor-help" />
              </TooltipTrigger>
              <TooltipContent>Geographic distribution of inbound API traffic.</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-48 rounded-md bg-surface-200/50 border border-dashed border-default flex flex-col items-center justify-center text-foreground-lighter gap-2">
            <Globe size={28} className="text-foreground-lighter/60" />
            <span className="text-xs font-mono">100% Asia/Dhaka & Regional Edge Gateways</span>
            <span className="text-[11px] text-foreground-lighter/60">No foreign unauthorized routing</span>
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-foreground-lighter text-sm font-medium m-0">Total Requests</h3>
          </div>
          <div className="text-2xl font-semibold text-foreground font-mono">13</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5 mb-4">
            {now.format('MMM D, YYYY, hh:mma')}
          </div>

          <div className="rounded-md border border-default overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-200/60 border-b border-default text-foreground-lighter font-medium">
                <tr>
                  <th className="py-2 px-3 font-normal">Request</th>
                  <th className="py-2 px-3 text-right font-normal">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default font-mono">
                <tr className="hover:bg-surface-200/40">
                  <td className="py-2 px-3 text-foreground flex items-center gap-2">
                    <span className="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px]">
                      POST
                    </span>
                    <span className="text-foreground-light">200</span>
                    <span className="truncate max-w-[240px]">/admin/v1/network-bans/retrieve</span>
                  </td>
                  <td className="py-2 px-3 text-right text-foreground font-bold">13</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Response Errors */}
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-foreground-lighter text-sm font-medium m-0">Response Errors</h3>
          </div>
          <div className="h-44 flex flex-col items-center justify-center text-foreground-lighter">
            <p className="text-xs font-medium text-foreground m-0">No data to show</p>
            <p className="text-[11px] text-foreground-lighter mt-1 m-0">
              It may take up to 24 hours for data to refresh
            </p>
          </div>
        </div>

        {/* Response Speed */}
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-foreground-lighter text-sm font-medium m-0">Response Speed</h3>
          </div>
          <div className="text-2xl font-semibold text-foreground font-mono">331.46 ms</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5 mb-4">
            {now.format('MMM D, YYYY, hh:mma')}
          </div>

          <div className="rounded-md border border-default overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-200/60 border-b border-default text-foreground-lighter font-medium">
                <tr>
                  <th className="py-2 px-3 font-normal">Request</th>
                  <th className="py-2 px-3 text-right font-normal">Count</th>
                  <th className="py-2 px-3 text-right font-normal">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default font-mono">
                <tr className="hover:bg-surface-200/40">
                  <td className="py-2 px-3 text-foreground flex items-center gap-2">
                    <span className="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px]">
                      POST
                    </span>
                    <span className="text-foreground-light">200</span>
                    <span className="truncate max-w-[180px]">/admin/v1/network-bans</span>
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">13</td>
                  <td className="py-2 px-3 text-right text-foreground font-bold">331.46 ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Network Traffic */}
        <div className="bg-surface-100 rounded-md border border-default p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-foreground-lighter text-sm font-medium m-0">Network Traffic</h3>
          </div>
          <div className="text-xs text-foreground-lighter uppercase font-medium mt-3">Ingress</div>
          <div className="text-2xl font-semibold text-foreground font-mono mt-0.5">0.000468 MB</div>
          <div className="text-xs text-foreground-lighter font-mono mt-0.5">
            {now.format('MMM D, YYYY, hh:mma')}
          </div>
        </div>
      </div>
    </div>
  )
}

ApiOverviewPage.getLayout = (page) => (
  <DefaultLayout>
    <ObservabilityLayout title="API Gateway">{page}</ObservabilityLayout>
  </DefaultLayout>
)

export default ApiOverviewPage
