import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { applyOrganizationTheme } from '../../styles/theme'
import type {
  AppearanceSettings,
  BusinessProfileSettings,
  Organization,
  OrganizationPreferences,
  SessionLogoData,
} from '../../types'
import { useDemoOrganization } from '../organizations/DemoOrganizationContext'
import { TicketEditorPanel } from '../tickets/components/TicketEditorPanel'
import { AppearanceSection } from './AppearanceSection'
import { BusinessProfileSection } from './BusinessProfileSection'
import {
  buildThemeFromColors,
  computeInitials,
  normalizeHexColor,
  validateAppearanceColors,
} from './colorUtils'
import { revokeLogoObjectUrl } from './logoUtils'
import { PreferencesSection } from './PreferencesSection'
import { UnsavedChangesModal } from './UnsavedChangesModal'
import {
  hasBusinessProfileErrors,
  validateBusinessProfile,
  type BusinessProfileErrors,
} from './validation'

interface SaveFeedbackState {
  type: 'success' | 'error' | 'info'
  message: string
}

export function OrganizationSettingsPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationSettingsForm
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationSettingsFormProps {
  organization: Organization
}

function OrganizationSettingsForm({
  organization,
}: OrganizationSettingsFormProps) {
  const {
    organizations,
    pendingSwitchOrgId,
    cancelPendingSwitch,
    forceSelectOrganization,
    setHasUnsavedSettingsChanges,
    saveOrganizationSettings,
    storageWarningsByOrg,
    simulateStorageError,
    setSimulateStorageError,
  } = useDemoOrganization()

  const [draftProfile, setDraftProfile] = useState<BusinessProfileSettings>(
    () => ({
      ...organization.businessProfile,
    }),
  )
  const [draftAppearance, setDraftAppearance] = useState<AppearanceSettings>(
    () => ({
      primaryColor: organization.primaryColor,
      accentColor: organization.accentColor,
    }),
  )
  const [draftPreferences, setDraftPreferences] =
    useState<OrganizationPreferences>(() => ({
      ...organization.preferences,
    }))
  const [draftLogo, setDraftLogo] = useState<SessionLogoData>(() => ({
    ...organization.logo,
  }))

  type SettingsTab = 'business' | 'appearance' | 'preferences' | 'tickets'
  const [activeTab, setActiveTab] = useState<SettingsTab>('business')
  const [hasTicketUnsavedChanges, setHasTicketUnsavedChanges] = useState(false)

  const [profileErrors, setProfileErrors] = useState<BusinessProfileErrors>({})
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState | null>(
    null,
  )

  const latestSavedThemeRef = useRef(organization.theme)
  const latestSavedLogoUrlRef = useRef(organization.logo.objectUrl)
  const latestDraftLogoUrlRef = useRef(draftLogo.objectUrl)

  useEffect(() => {
    latestSavedThemeRef.current = organization.theme
    latestSavedLogoUrlRef.current = organization.logo.objectUrl
  }, [organization.theme, organization.logo.objectUrl])

  useEffect(() => {
    latestDraftLogoUrlRef.current = draftLogo.objectUrl
  }, [draftLogo.objectUrl])

  const colorValidation = useMemo(
    () =>
      validateAppearanceColors(
        draftAppearance.primaryColor,
        draftAppearance.accentColor,
      ),
    [draftAppearance.primaryColor, draftAppearance.accentColor],
  )

  const isProfileDirty =
    draftProfile.commercialName !==
      organization.businessProfile.commercialName ||
    draftProfile.phone !== organization.businessProfile.phone ||
    draftProfile.email !== organization.businessProfile.email ||
    draftProfile.address !== organization.businessProfile.address ||
    draftProfile.website !== organization.businessProfile.website

  const isAppearanceDirty =
    normalizeHexColor(draftAppearance.primaryColor) !==
      organization.primaryColor ||
    normalizeHexColor(draftAppearance.accentColor) !==
      organization.accentColor ||
    draftLogo.objectUrl !== organization.logo.objectUrl

  const isPreferencesDirty =
    draftPreferences.currency !== organization.preferences.currency ||
    draftPreferences.timezone !== organization.preferences.timezone ||
    draftPreferences.dateFormat !== organization.preferences.dateFormat

  const isDirty = isProfileDirty || isAppearanceDirty || isPreferencesDirty

  useEffect(() => {
    setHasUnsavedSettingsChanges(isDirty || hasTicketUnsavedChanges)
    return () => {
      setHasUnsavedSettingsChanges(false)
    }
  }, [isDirty, hasTicketUnsavedChanges, setHasUnsavedSettingsChanges])

  // Vista previa en tiempo real de colores válidos; bloquea combinaciones ilegibles
  useEffect(() => {
    if (colorValidation.isValid) {
      applyOrganizationTheme(
        buildThemeFromColors(
          draftAppearance.primaryColor,
          draftAppearance.accentColor,
        ),
      )
    } else {
      applyOrganizationTheme(organization.theme)
    }
  }, [
    colorValidation.isValid,
    draftAppearance.primaryColor,
    draftAppearance.accentColor,
    organization.theme,
  ])

  // Al desmontar el formulario sin guardar, restaurar el tema guardado y liberar URL temporal no guardada
  useEffect(() => {
    return () => {
      applyOrganizationTheme(latestSavedThemeRef.current)
      if (
        latestDraftLogoUrlRef.current &&
        latestDraftLogoUrlRef.current !== latestSavedLogoUrlRef.current
      ) {
        revokeLogoObjectUrl(latestDraftLogoUrlRef.current)
      }
    }
  }, [])

  const previewInitials = useMemo(() => {
    const fallback = computeInitials(
      organization.initialSettings.businessProfile.commercialName,
      'NX',
    )
    return computeInitials(draftProfile.commercialName, fallback)
  }, [draftProfile.commercialName, organization.initialSettings])

  const handleProfileFieldChange = (
    field: keyof BusinessProfileSettings,
    value: string,
  ) => {
    setDraftProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (profileErrors[field]) {
      setProfileErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }))
    }
    if (saveFeedback) {
      setSaveFeedback(null)
    }
  }

  const handleColorChange = (
    field: keyof AppearanceSettings,
    value: string,
  ) => {
    setDraftAppearance((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (saveFeedback) {
      setSaveFeedback(null)
    }
  }

  const handleSelectValidLogo = (nextLogo: SessionLogoData) => {
    if (
      draftLogo.objectUrl &&
      draftLogo.objectUrl !== organization.logo.objectUrl &&
      draftLogo.objectUrl !== nextLogo.objectUrl
    ) {
      revokeLogoObjectUrl(draftLogo.objectUrl)
    }
    setDraftLogo(nextLogo)
    setSaveFeedback(null)
  }

  const handleRemoveLogo = () => {
    if (
      draftLogo.objectUrl &&
      draftLogo.objectUrl !== organization.logo.objectUrl
    ) {
      revokeLogoObjectUrl(draftLogo.objectUrl)
    }
    setDraftLogo({
      objectUrl: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
    })
    setSaveFeedback(null)
  }

  const handleConfirmResetAppearance = () => {
    if (
      draftLogo.objectUrl &&
      draftLogo.objectUrl !== organization.logo.objectUrl
    ) {
      revokeLogoObjectUrl(draftLogo.objectUrl)
    }
    setDraftAppearance({
      primaryColor: organization.initialSettings.appearance.primaryColor,
      accentColor: organization.initialSettings.appearance.accentColor,
    })
    setDraftLogo({
      objectUrl: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
    })
    setSaveFeedback({
      type: 'info',
      message:
        'Se cargaron los colores originales y se quitó el logo en la vista previa. Haz clic en "Guardar cambios" para confirmar.',
    })
  }

  const handlePreferenceChange = <K extends keyof OrganizationPreferences>(
    field: K,
    value: OrganizationPreferences[K],
  ) => {
    setDraftPreferences((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (saveFeedback) {
      setSaveFeedback(null)
    }
  }

  const handleDiscardChanges = () => {
    if (
      draftLogo.objectUrl &&
      draftLogo.objectUrl !== organization.logo.objectUrl
    ) {
      revokeLogoObjectUrl(draftLogo.objectUrl)
    }

    setDraftProfile({ ...organization.businessProfile })
    setDraftAppearance({
      primaryColor: organization.primaryColor,
      accentColor: organization.accentColor,
    })
    setDraftPreferences({ ...organization.preferences })
    setDraftLogo({ ...organization.logo })
    setProfileErrors({})
    applyOrganizationTheme(organization.theme)
    setSaveFeedback({
      type: 'info',
      message:
        'Se descartaron los cambios pendientes y se restauraron los valores guardados de la organización.',
    })
  }

  const executeSave = (): boolean => {
    const validatedProfileErrors = validateBusinessProfile(draftProfile)
    setProfileErrors(validatedProfileErrors)

    if (hasBusinessProfileErrors(validatedProfileErrors)) {
      setSaveFeedback({
        type: 'error',
        message:
          'Existen errores de validación en los datos del negocio. Corrige los campos señalados; tus datos ingresados se conservaron.',
      })
      return false
    }

    if (!colorValidation.isValid) {
      setSaveFeedback({
        type: 'error',
        message:
          colorValidation.primaryError ??
          colorValidation.accentError ??
          'La combinación de colores seleccionada no es válida o no cumple el contraste mínimo legible.',
      })
      return false
    }

    const normalizedPrimary = normalizeHexColor(draftAppearance.primaryColor)
    const normalizedAccent = normalizeHexColor(draftAppearance.accentColor)

    const cleanProfile: BusinessProfileSettings = {
      commercialName: draftProfile.commercialName.trim(),
      phone: draftProfile.phone.trim(),
      email: draftProfile.email.trim(),
      address: draftProfile.address.trim(),
      website: draftProfile.website.trim(),
    }

    const outcome = saveOrganizationSettings(
      organization.id,
      {
        businessProfile: cleanProfile,
        appearance: {
          primaryColor: normalizedPrimary,
          accentColor: normalizedAccent,
        },
        preferences: { ...draftPreferences },
      },
      draftLogo,
    )

    if (!outcome.ok) {
      setSaveFeedback({
        type: 'error',
        message: outcome.error,
      })
      return false
    }

    setDraftProfile(cleanProfile)
    setDraftAppearance({
      primaryColor: normalizedPrimary,
      accentColor: normalizedAccent,
    })
    setSaveFeedback({
      type: 'success',
      message: `Configuración de "${cleanProfile.commercialName}" guardada correctamente en el almacenamiento local de demostración.`,
    })
    return true
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    executeSave()
  }

  const pendingTargetOrganization = useMemo(() => {
    if (!pendingSwitchOrgId) {
      return null
    }
    return (
      organizations.find((org) => org.id === pendingSwitchOrgId) ?? null
    )
  }, [organizations, pendingSwitchOrgId])

  const handleSaveAndSwitch = () => {
    if (!pendingSwitchOrgId) {
      return
    }
    const saved = executeSave()
    if (saved) {
      forceSelectOrganization(pendingSwitchOrgId)
    } else {
      cancelPendingSwitch()
    }
  }

  const handleDiscardAndSwitch = () => {
    if (!pendingSwitchOrgId) {
      return
    }
    if (
      draftLogo.objectUrl &&
      draftLogo.objectUrl !== organization.logo.objectUrl
    ) {
      revokeLogoObjectUrl(draftLogo.objectUrl)
    }
    applyOrganizationTheme(organization.theme)
    forceSelectOrganization(pendingSwitchOrgId)
  }

  const storageWarning = storageWarningsByOrg[organization.id]

  return (
    <div className="settings-page">
      <PageHeader
        title={`Configuración · ${organization.name}`}
        description="Administra los datos comerciales, logotipo, paleta de colores, preferencias de formato y diseño de tickets de la organización activa."
        badge={<Badge variant="demo">Modo demostración</Badge>}
        actions={
          activeTab !== 'tickets' ? (
            <div className="page-header-actions-group">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
                disabled={!isDirty}
              >
                Descartar cambios
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  executeSave()
                }}
                disabled={!isDirty}
              >
                Guardar cambios
              </Button>
            </div>
          ) : null
        }
      />

      {/* Selector de pestañas de configuración */}
      <div
        className="settings-tabs-nav"
        role="tablist"
        aria-label="Secciones de configuración de la organización"
      >
        <button
          type="button"
          role="tab"
          id="tab-business"
          aria-controls="panel-business"
          aria-selected={activeTab === 'business'}
          className={`settings-tab-btn ${
            activeTab === 'business' ? 'settings-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('business')}
        >
          Datos comerciales
        </button>
        <button
          type="button"
          role="tab"
          id="tab-appearance"
          aria-controls="panel-appearance"
          aria-selected={activeTab === 'appearance'}
          className={`settings-tab-btn ${
            activeTab === 'appearance' ? 'settings-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('appearance')}
        >
          Apariencia y logo
        </button>
        <button
          type="button"
          role="tab"
          id="tab-preferences"
          aria-controls="panel-preferences"
          aria-selected={activeTab === 'preferences'}
          className={`settings-tab-btn ${
            activeTab === 'preferences' ? 'settings-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('preferences')}
        >
          Preferencias
        </button>
        <button
          type="button"
          role="tab"
          id="tab-tickets"
          aria-controls="panel-tickets"
          aria-selected={activeTab === 'tickets'}
          className={`settings-tab-btn ${
            activeTab === 'tickets' ? 'settings-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('tickets')}
        >
          Tickets y comprobantes
        </button>
      </div>

      {/* Aviso breve de Modo demostración */}
      <div
        className="demo-brief-banner"
        role="note"
        aria-label="Aviso de modo demostración"
      >
        <p className="demo-brief-banner__text">
          <strong>Modo demostración:</strong> Los cambios se guardan localmente
          en este navegador. El logotipo es temporal durante la sesión actual y
          cambiar la moneda no convierte los importes registrados.
        </p>
      </div>

      {storageWarning ? (
        <div className="settings-feedback settings-feedback--warning" role="alert">
          <strong>Aviso de almacenamiento local:</strong> {storageWarning}
        </div>
      ) : null}

      {/* Aviso de cambios pendientes */}
      {isDirty ? (
        <div
          className="settings-unsaved-bar"
          role="status"
          aria-live="polite"
        >
          <div className="settings-unsaved-bar__text">
            <strong>Tienes cambios pendientes sin guardar</strong> en{' '}
            <span>{organization.name}</span>. Guarda para aplicar los cambios de
            forma persistente o descártalos para restaurar la configuración
            anterior.
          </div>
          <div className="settings-unsaved-bar__actions">
            <Button variant="outline" size="sm" onClick={handleDiscardChanges}>
              Descartar cambios
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                executeSave()
              }}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      ) : null}

      {/* Estado de guardado o error anunciado de forma accesible */}
      {saveFeedback ? (
        <div
          className={`settings-feedback settings-feedback--${saveFeedback.type}`}
          role={saveFeedback.type === 'error' ? 'alert' : 'status'}
          aria-live={saveFeedback.type === 'error' ? 'assertive' : 'polite'}
        >
          <span>{saveFeedback.message}</span>
        </div>
      ) : null}

      {activeTab === 'tickets' ? (
        <div id="panel-tickets" role="tabpanel" aria-labelledby="tab-tickets">
          <TicketEditorPanel
            organization={organization}
            onUnsavedChangesChange={setHasTicketUnsavedChanges}
          />
        </div>
      ) : (
        <form
          onSubmit={handleFormSubmit}
          className="settings-sections-stack"
          noValidate
        >
          {activeTab === 'business' ? (
            <div id="panel-business" role="tabpanel" aria-labelledby="tab-business">
              <BusinessProfileSection
                values={draftProfile}
                errors={profileErrors}
                isDirty={isProfileDirty}
                onChangeField={handleProfileFieldChange}
              />
            </div>
          ) : null}

          {activeTab === 'appearance' ? (
            <div id="panel-appearance" role="tabpanel" aria-labelledby="tab-appearance">
              <AppearanceSection
                organization={organization}
                previewCommercialName={draftProfile.commercialName}
                previewInitials={previewInitials}
                appearance={draftAppearance}
                initialAppearance={organization.initialSettings.appearance}
                colorValidation={colorValidation}
                draftLogo={draftLogo}
                isDirty={isAppearanceDirty}
                onChangeColor={handleColorChange}
                onSelectValidLogo={handleSelectValidLogo}
                onRemoveLogo={handleRemoveLogo}
                onConfirmResetAppearance={handleConfirmResetAppearance}
              />
            </div>
          ) : null}

          {activeTab === 'preferences' ? (
            <div id="panel-preferences" role="tabpanel" aria-labelledby="tab-preferences">
              <PreferencesSection
                values={draftPreferences}
                isDirty={isPreferencesDirty}
                onChangePreference={handlePreferenceChange}
              />
            </div>
          ) : null}

          <div className="settings-footer-bar">
            <div className="settings-footer-bar__meta">
              {organization.updatedAt ? (
                <span>
                  Último guardado local:{' '}
                  <strong>
                    {new Date(organization.updatedAt).toLocaleTimeString(
                      'es-MX',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      },
                    )}
                  </strong>
                </span>
              ) : (
                <span>Usando valores iniciales de demostración</span>
              )}
            </div>

            <div className="settings-footer-bar__actions">
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscardChanges}
                disabled={!isDirty}
              >
                Descartar cambios
              </Button>
              <Button type="submit" variant="primary" disabled={!isDirty}>
                Guardar cambios en {organization.name}
              </Button>
            </div>
          </div>
        </form>
      )}

      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Área de desarrollo y verificación QA (simulación de fallos)
        </summary>
        <div className="dev-tools-drawer__body">
          <label className="storage-test-toggle">
            <input
              type="checkbox"
              checked={simulateStorageError}
              onChange={(event) =>
                setSimulateStorageError(event.target.checked)
              }
            />
            <span>Simular fallo al guardar en almacenamiento local</span>
          </label>
        </div>
      </details>

      {pendingTargetOrganization ? (
        <UnsavedChangesModal
          currentOrgName={organization.name}
          targetOrgName={pendingTargetOrganization.name}
          onSaveAndSwitch={handleSaveAndSwitch}
          onDiscardAndSwitch={handleDiscardAndSwitch}
          onCancelSwitch={cancelPendingSwitch}
        />
      ) : null}
    </div>
  )
}

