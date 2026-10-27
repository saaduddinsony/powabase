import { useParams } from 'common'
import { useState } from 'react'
import { toast } from 'sonner'

import { Overview } from '@/components/interfaces/BranchManagement/Overview'
import BranchLayout from '@/components/layouts/BranchLayout/BranchLayout'
import { DefaultLayout } from '@/components/layouts/DefaultLayout'
import { TextConfirmModal } from '@/components/ui/TextConfirmModalWrapper'
import { useBranchDeleteMutation } from '@/data/branches/branch-delete-mutation'
import { useBranchesQuery, type Branch } from '@/data/branches/branches-query'
import { useAppStateSnapshot } from '@/state/app-state'
import type { NextPageWithLayout } from '@/types'

const BranchesPage: NextPageWithLayout = () => {
  const { ref: projectRef = 'default' } = useParams()
  const snap = useAppStateSnapshot()
  const [selectedBranchToDelete, setSelectedBranchToDelete] = useState<Branch | null>(null)

  const { data: branches, isPending: isLoading, isSuccess } = useBranchesQuery({ projectRef })

  const { mutate: deleteBranch, isPending: isDeleting } = useBranchDeleteMutation({
    onSuccess: () => {
      toast.success('Branch deleted successfully')
      setSelectedBranchToDelete(null)
    },
    onError: (error) => {
      toast.error(`Failed to delete branch: ${error.message}`)
    },
  })

  const mainBranch = branches?.find((b) => b.is_default) ?? {
    id: `main_${projectRef}`,
    name: 'main',
    project_ref: projectRef,
    parent_project_ref: projectRef,
    git_branch: 'main',
    is_default: true,
    status: 'MIGRATIONS_PASSED',
    preview_project_status: 'ACTIVE_HEALTHY',
    persistent: true,
    with_data: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Branch

  const previewBranches = branches?.filter((b) => !b.is_default) ?? []

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Branches</h1>
          <p className="text-sm text-foreground-lighter">
            Manage your database preview branches and sandbox environments
          </p>
        </div>
      </div>

      <Overview
        isGithubConnected={false}
        isLoading={isLoading}
        isSuccess={isSuccess}
        repo=""
        mainBranch={mainBranch}
        previewBranches={previewBranches}
        onSelectCreateBranch={() => snap.setShowCreateBranchModal(true)}
        onSelectDeleteBranch={(branch) => setSelectedBranchToDelete(branch)}
        generateCreatePullRequestURL={() => ''}
      />

      <TextConfirmModal
        visible={selectedBranchToDelete !== null}
        onCancel={() => setSelectedBranchToDelete(null)}
        onConfirm={() => {
          if (selectedBranchToDelete) {
            deleteBranch({
              branchRef: selectedBranchToDelete.id || selectedBranchToDelete.name,
              projectRef,
            })
          }
        }}
        title="Delete Branch"
        confirmString={selectedBranchToDelete?.name ?? ''}
        confirmLabel="Delete Branch"
        confirmPlaceholder="Type branch name to confirm"
        loading={isDeleting}
        alert={{
          title: `You are about to delete the branch '${selectedBranchToDelete?.name}'`,
          description:
            'This action will permanently delete the preview database schema and all isolated data. This cannot be undone.',
        }}
      />
    </div>
  )
}

BranchesPage.getLayout = (page) => (
  <DefaultLayout>
    <BranchLayout>{page}</BranchLayout>
  </DefaultLayout>
)

export default BranchesPage
