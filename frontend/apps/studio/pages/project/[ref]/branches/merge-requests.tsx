import { useParams } from 'common'
import { GitPullRequest, ListTree } from 'lucide-react'
import Link from 'next/link'
import { Button } from 'ui'

import { ReviewRow } from '@/components/interfaces/BranchManagement/ReviewRow'
import BranchLayout from '@/components/layouts/BranchLayout/BranchLayout'
import { useBranchesQuery } from '@/data/branches/branches-query'
import type { NextPageWithLayout } from '@/types'

const MergeRequestsPage: NextPageWithLayout = () => {
  const { ref: projectRef = 'default' } = useParams()
  const { data: branches, isPending: isLoading } = useBranchesQuery({ projectRef })

  const previewBranches = branches?.filter((b) => !b.is_default) ?? []

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Merge Requests</h1>
          <p className="text-sm text-foreground-lighter">
            Review schema differences and merge preview branches into production
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-100 divide-y divide-border overflow-hidden">
        {isLoading && (
          <div className="p-6 text-center text-sm text-foreground-lighter">
            Loading branches...
          </div>
        )}

        {!isLoading && previewBranches.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <GitPullRequest size={32} strokeWidth={1.5} className="text-foreground-lighter" />
            <h3 className="text-sm font-medium text-foreground">No open merge requests</h3>
            <p className="text-xs text-foreground-lighter max-w-sm">
              Create a preview branch and test your schema changes. When you are ready, review and merge them back to main.
            </p>
            <Button asChild size="tiny" type="default" icon={<ListTree size={14} />}>
              <Link href={`/project/${projectRef}/branches`}>View Branches</Link>
            </Button>
          </div>
        )}

        {!isLoading && previewBranches.length > 0 && (
          previewBranches.map((branch) => (
            <ReviewRow key={branch.id} branch={branch} />
          ))
        )}
      </div>
    </div>
  )
}

MergeRequestsPage.getLayout = (page) => <BranchLayout>{page}</BranchLayout>

export default MergeRequestsPage
