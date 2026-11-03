import { createContext, useContext } from 'react'
import type { SaveSettingsOutcome } from '../../services/settings/organizationSettingsRepository'
import type {
  DemoUser,
  Organization,
  SerializableOrganizationSettings,
  SessionLogoData,
} from '../../types'

export interface DemoOrganizationContextValue {
  organizations: Organization[]
  activeOrganization: Organization
  selectOrganization: (organizationId: string) => boolean
  forceSelectOrganization: (organizationId: string) => void
  pendingSwitchOrgId: string | null
  cancelPendingSwitch: () => void
  hasUnsavedSettingsChanges: boolean
  setHasUnsavedSettingsChanges: (isDirty: boolean) => void
  saveOrganizationSettings: (
    organizationId: string,
    settings: SerializableOrganizationSettings,
    nextLogo: SessionLogoData,
  ) => SaveSettingsOutcome
  storageWarningsByOrg: Record<string, string | undefined>
  simulateStorageError: boolean
  setSimulateStorageError: (simulate: boolean) => void
  demoUser: DemoUser
  updateDemoOperatorName: (name: string) => void
}

export const DemoOrganizationContext =
  createContext<DemoOrganizationContextValue | null>(null)

export function useDemoOrganization(): DemoOrganizationContextValue {
  const context = useContext(DemoOrganizationContext)
  if (!context) {
    throw new Error(
      'useDemoOrganization debe utilizarse dentro de DemoOrganizationProvider',
    )
  }
  return context
}
