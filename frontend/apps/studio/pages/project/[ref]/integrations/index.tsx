import { ReactElement } from 'react'
import { ScaffoldContainer, ScaffoldHeader, ScaffoldTitle, ScaffoldDescription } from '@/components/layouts/Scaffold'
import { AvailableIntegrations } from '@/components/interfaces/Integrations/Landing/AvailableIntegrations'
import { InstalledIntegrations } from '@/components/interfaces/Integrations/Landing/InstalledIntegrations'
import { ProjectIntegrationsLayout } from '@/components/layouts/ProjectIntegrationsLayout'
import type { NextPageWithLayout } from 'types'

const ProjectIntegrationsPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col pb-12">
      <ScaffoldContainer>
        <ScaffoldHeader className="pt-6">
          <ScaffoldTitle>Extend your database</ScaffoldTitle>
          <ScaffoldDescription>
            Explore native and third-party integrations to add functionality to your Socket project.
          </ScaffoldDescription>
        </ScaffoldHeader>
      </ScaffoldContainer>
      <InstalledIntegrations />
      <AvailableIntegrations />
    </div>
  )
}

ProjectIntegrationsPage.getLayout = (page: ReactElement) => (
  <ProjectIntegrationsLayout>{page}</ProjectIntegrationsLayout>
)

export default ProjectIntegrationsPage
