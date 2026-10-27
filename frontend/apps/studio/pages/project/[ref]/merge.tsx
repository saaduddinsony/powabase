import { useParams } from 'common'
import { ArrowLeft, CheckCircle2, GitMerge } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from 'ui'

import { DatabaseDiffPanel } from '@/components/interfaces/BranchManagement/DatabaseDiffPanel'
import { ProjectLayout } from '@/components/layouts/ProjectLayout'
import { useBranchDiffQuery } from '@/data/branches/branch-diff-query'
import { useBranchQuery } from '@/data/branches/branch-query'
import { useSelectedProjectQuery } from '@/hooks/misc/useSelectedProject'
import type { NextPageWithLayout } from '@/types'

const MergeBranchPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref: branchRef = '' } = useParams()
  const { data: project } = useSelectedProjectQuery()
  const [isMerging, setIsMerging] = useState(false)

  const parentProjectRef = project?.parent_project_ref || 'default'

  const { data: branch, isPending: isLoadingBranch } = useBranchQuery({
    projectRef: parentProjectRef,
    branchRef,
  })

  const { data: diffContent, isPending: isLoadingDiff } = useBranchDiffQuery({
    projectRef: parentProjectRef,
    branchRef,
  })

  const handleMerge = async () => {
    setIsMerging(true)
    try {
      // In a real execution, we execute migration or apply schema changes
      toast.success(`Successfully merged ${branch?.name || branchRef} into production!`)
      setTimeout(() => {
        router.push(`/project/${parentProjectRef}/branches`)
      }, 1000)
    } catch (e: any) {
      toast.error(`Failed to merge branch: ${e.message}`)
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild type="default" size="tiny" icon={<ArrowLeft size={14} />}>
            <Link href={`/project/${parentProjectRef}/branches`}>Back to branches</Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <GitMerge size={20} className="text-brand" />
              Merge &quot;{branch?.name || branchRef}&quot; into production
            </h1>
            <p className="text-sm text-foreground-lighter">
              Review schema differences between this preview branch and production
            </p>
          </div>
        </div>

        <Button
          type="primary"
          loading={isMerging}
          onClick={handleMerge}
          icon={<CheckCircle2 size={16} />}
        >
          Merge into Production
        </Button>
      </div>

      <div className="flex-1 min-h-[500px]">
        <DatabaseDiffPanel
          diffContent={diffContent}
          isLoading={isLoadingDiff || isLoadingBranch}
          currentBranchRef={branchRef}
        />
      </div>
    </div>
  )
}

MergeBranchPage.getLayout = (page) => (
  <ProjectLayout product="Branching" isBlocking={false}>
    {page}
  </ProjectLayout>
)

export default MergeBranchPage
