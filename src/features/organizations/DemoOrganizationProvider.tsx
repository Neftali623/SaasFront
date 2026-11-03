import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_DEMO_USER, DEMO_ORGANIZATIONS } from '../../mocks/organizations'
import {
  defaultOrganizationSettingsRepository,
  type SaveSettingsOutcome,
} from '../../services/settings/organizationSettingsRepository'
import { applyOrganizationTheme } from '../../styles/theme'
import type {
  Organization,
  SerializableOrganizationSettings,
  SessionLogoData,
} from '../../types'
import {
  buildThemeFromColors,
  computeInitials,
  normalizeHexColor,
} from '../settings/colorUtils'
import { revokeLogoObjectUrl } from '../settings/logoUtils'
import { DemoOrganizationContext } from './DemoOrganizationContext'

export interface DemoOrganizationProviderProps {
  children: ReactNode
}

interface InitialHydrationState {
  organizations: Organization[]
  warnings: Record<string, string | undefined>
}

function hydrateInitialOrganizations(): InitialHydrationState {
  const warnings: Record<string, string | undefined> = {}

  const organizations = DEMO_ORGANIZATIONS.map((baseOrg) => {
    const outcome = defaultOrganizationSettingsRepository.load(
      baseOrg.id,
      baseOrg.initialSettings,
    )
    if (outcome.warning) {
      warnings[baseOrg.id] = outcome.warning
    }

    const { businessProfile, appearance, preferences } = outcome.settings
    const primaryColor = normalizeHexColor(appearance.primaryColor)
    const accentColor = normalizeHexColor(appearance.accentColor)

    return {
      ...baseOrg,
      name: businessProfile.commercialName,
      initials: computeInitials(
        businessProfile.commercialName,
        baseOrg.initials,
      ),
      primaryColor,
      accentColor,
      theme: buildThemeFromColors(primaryColor, accentColor),
      businessProfile: { ...businessProfile },
      preferences: { ...preferences },
      updatedAt: outcome.updatedAt,
    }
  })

  return { organizations, warnings }
}

/**
 * Proveedor para el contexto de demostración de organizaciones.
 * Carga ajustes serializables por organización desde localStorage (con versión de esquema)
 * y mantiene el logotipo únicamente en memoria de la sesión actual.
 */
export function DemoOrganizationProvider({
  children,
}: DemoOrganizationProviderProps) {
  const [initialState] = useState<InitialHydrationState>(() =>
    hydrateInitialOrganizations(),
  )
  const [organizations, setOrganizations] = useState<Organization[]>(
    initialState.organizations,
  )
  const [storageWarningsByOrg] = useState<Record<string, string | undefined>>(
    initialState.warnings,
  )
  const [activeOrgId, setActiveOrgId] = useState<string>(
    initialState.organizations[0].id,
  )
  const [operatorName, setOperatorName] = useState<string>(
    DEFAULT_DEMO_USER.name,
  )
  const [hasUnsavedSettingsChanges, setHasUnsavedSettingsChanges] =
    useState<boolean>(false)
  const [pendingSwitchOrgId, setPendingSwitchOrgId] = useState<string | null>(
    null,
  )
  const [simulateStorageError, setSimulateStorageError] =
    useState<boolean>(false)

  const activeOrganization = useMemo(() => {
    return (
      organizations.find((org) => org.id === activeOrgId) ?? organizations[0]
    )
  }, [organizations, activeOrgId])

  useEffect(() => {
    applyOrganizationTheme(activeOrganization.theme)
  }, [activeOrganization])

  const selectOrganization = useCallback(
    (organizationId: string): boolean => {
      if (organizationId === activeOrgId) {
        return true
      }

      const exists = organizations.some((org) => org.id === organizationId)
      if (!exists) {
        return false
      }

      if (hasUnsavedSettingsChanges) {
        setPendingSwitchOrgId(organizationId)
        return false
      }

      setPendingSwitchOrgId(null)
      setActiveOrgId(organizationId)
      return true
    },
    [activeOrgId, organizations, hasUnsavedSettingsChanges],
  )

  const forceSelectOrganization = useCallback(
    (organizationId: string) => {
      const exists = organizations.some((org) => org.id === organizationId)
      if (!exists) {
        return
      }
      setHasUnsavedSettingsChanges(false)
      setPendingSwitchOrgId(null)
      setActiveOrgId(organizationId)
    },
    [organizations],
  )

  const cancelPendingSwitch = useCallback(() => {
    setPendingSwitchOrgId(null)
  }, [])

  const saveOrganizationSettings = useCallback(
    (
      organizationId: string,
      settings: SerializableOrganizationSettings,
      nextLogo: SessionLogoData,
    ): SaveSettingsOutcome => {
      const targetOrg = organizations.find((org) => org.id === organizationId)
      if (!targetOrg) {
        return {
          ok: false,
          error: 'No se encontró la organización destino para guardar los ajustes.',
        }
      }

      if (simulateStorageError) {
        return {
          ok: false,
          error:
            'Fallo simulado de almacenamiento local: no se escribieron los cambios en localStorage. Tus datos en el formulario se conservaron intactos.',
        }
      }

      const saveOutcome = defaultOrganizationSettingsRepository.save(
        organizationId,
        settings,
      )
      if (!saveOutcome.ok) {
        return saveOutcome
      }

      const cleanName = settings.businessProfile.commercialName.trim()
      const primaryColor = normalizeHexColor(settings.appearance.primaryColor)
      const accentColor = normalizeHexColor(settings.appearance.accentColor)
      const defaultInitials = computeInitials(
        targetOrg.initialSettings.businessProfile.commercialName,
        'NX',
      )

      setOrganizations((prevOrgs) =>
        prevOrgs.map((org) => {
          if (org.id !== organizationId) {
            return org
          }

          if (
            org.logo.objectUrl &&
            org.logo.objectUrl !== nextLogo.objectUrl
          ) {
            revokeLogoObjectUrl(org.logo.objectUrl)
          }

          return {
            ...org,
            name: cleanName,
            initials: computeInitials(cleanName, defaultInitials),
            primaryColor,
            accentColor,
            theme: buildThemeFromColors(primaryColor, accentColor),
            businessProfile: {
              commercialName: cleanName,
              phone: settings.businessProfile.phone.trim(),
              email: settings.businessProfile.email.trim(),
              address: settings.businessProfile.address.trim(),
              website: settings.businessProfile.website.trim(),
            },
            preferences: { ...settings.preferences },
            logo: { ...nextLogo },
            updatedAt: saveOutcome.updatedAt,
          }
        }),
      )

      return saveOutcome
    },
    [organizations, simulateStorageError],
  )

  const value = useMemo(
    () => ({
      organizations,
      activeOrganization,
      selectOrganization,
      forceSelectOrganization,
      pendingSwitchOrgId,
      cancelPendingSwitch,
      hasUnsavedSettingsChanges,
      setHasUnsavedSettingsChanges,
      saveOrganizationSettings,
      storageWarningsByOrg,
      simulateStorageError,
      setSimulateStorageError,
      demoUser: {
        ...DEFAULT_DEMO_USER,
        name: operatorName.trim() || DEFAULT_DEMO_USER.name,
      },
      updateDemoOperatorName: (name: string) => {
        setOperatorName(name)
      },
    }),
    [
      organizations,
      activeOrganization,
      selectOrganization,
      forceSelectOrganization,
      pendingSwitchOrgId,
      cancelPendingSwitch,
      hasUnsavedSettingsChanges,
      saveOrganizationSettings,
      storageWarningsByOrg,
      simulateStorageError,
      operatorName,
    ],
  )

  return (
    <DemoOrganizationContext.Provider value={value}>
      {children}
    </DemoOrganizationContext.Provider>
  )
}
