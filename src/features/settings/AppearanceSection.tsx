import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type {
  AppearanceSettings,
  Organization,
  SessionLogoData,
} from '../../types'
import { OrganizationAvatar } from '../organizations/OrganizationAvatar'
import {
  buildThemeFromColors,
  isValidHexColor,
  normalizeHexColor,
  type ColorValidationResult,
} from './colorUtils'
import {
  formatFileSize,
  MAX_LOGO_SIZE_LABEL,
  validateAndDecodeLogoFile,
} from './logoUtils'

export interface AppearanceSectionProps {
  organization: Organization
  previewCommercialName: string
  previewInitials: string
  appearance: AppearanceSettings
  initialAppearance: AppearanceSettings
  colorValidation: ColorValidationResult
  draftLogo: SessionLogoData
  isDirty: boolean
  onChangeColor: (field: keyof AppearanceSettings, value: string) => void
  onSelectValidLogo: (logo: SessionLogoData) => void
  onRemoveLogo: () => void
  onConfirmResetAppearance: () => void
}

export function AppearanceSection({
  organization,
  previewCommercialName,
  previewInitials,
  appearance,
  initialAppearance,
  colorValidation,
  draftLogo,
  isDirty,
  onChangeColor,
  onSelectValidLogo,
  onRemoveLogo,
  onConfirmResetAppearance,
}: AppearanceSectionProps) {
  const fileInputId = useId()
  const primaryPickerId = useId()
  const accentPickerId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [logoError, setLogoError] = useState<string | null>(null)
  const [isCheckingLogo, setIsCheckingLogo] = useState<boolean>(false)
  const [logoDimensions, setLogoDimensions] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false)

  const normalizedPrimary = normalizeHexColor(appearance.primaryColor)
  const normalizedAccent = normalizeHexColor(appearance.accentColor)
  const pickerPrimaryValue = isValidHexColor(normalizedPrimary)
    ? normalizedPrimary
    : organization.primaryColor
  const pickerAccentValue = isValidHexColor(normalizedAccent)
    ? normalizedAccent
    : organization.accentColor

  const previewTheme = colorValidation.isValid
    ? buildThemeFromColors(normalizedPrimary, normalizedAccent)
    : organization.theme

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setIsCheckingLogo(true)
    setLogoError(null)

    const result = await validateAndDecodeLogoFile(file)
    setIsCheckingLogo(false)

    if (!result.ok) {
      setLogoError(result.error)
      return
    }

    setLogoDimensions(`${result.width}×${result.height} px`)
    onSelectValidLogo({
      objectUrl: result.objectUrl,
      fileName: result.fileName,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    })
  }

  const handleRemoveLogoClick = () => {
    setLogoError(null)
    setLogoDimensions(null)
    onRemoveLogo()
  }

  return (
    <Card
      as="section"
      title="2. Apariencia e identidad visual"
      subtitle="Personaliza el logotipo de sesión y los colores de marca de esta organización"
      headerAction={
        isDirty ? (
          <Badge variant="warning">Vista previa sin guardar</Badge>
        ) : (
          <Badge variant="neutral">Tema guardado</Badge>
        )
      }
    >
      <div className="appearance-section-stack">
        {/* Bloque de Logotipo */}
        <div className="appearance-logo-block">
          <div className="appearance-logo-block__preview">
            <OrganizationAvatar
              organization={organization}
              size="lg"
              overrideLogoUrl={draftLogo.objectUrl}
              overrideInitials={previewInitials}
              overridePrimaryColor={previewTheme.primaryColor}
              overrideAccentColor={previewTheme.accentColor}
            />
            <div className="appearance-logo-block__status">
              <span className="appearance-logo-block__status-title">
                {draftLogo.objectUrl
                  ? 'Logotipo personalizado (sesión actual)'
                  : `Identificador con iniciales (${previewInitials})`}
              </span>
              <span className="appearance-logo-block__status-meta">
                {draftLogo.objectUrl && draftLogo.fileName
                  ? `${draftLogo.fileName} (${formatFileSize(draftLogo.sizeBytes ?? 0)}${
                      logoDimensions ? ` · ${logoDimensions}` : ''
                    })`
                  : 'Cuando no hay logotipo activo se muestran las iniciales del nombre comercial.'}
              </span>
            </div>
          </div>

          <div className="appearance-logo-block__controls">
            <div className="appearance-logo-block__buttons">
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only-file-input"
                onChange={handleFileChange}
                disabled={isCheckingLogo}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCheckingLogo}
              >
                {isCheckingLogo
                  ? 'Verificando imagen...'
                  : draftLogo.objectUrl
                    ? 'Cambiar logo de demostración'
                    : 'Seleccionar logo (PNG, JPEG, WebP)'}
              </Button>

              {draftLogo.objectUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogoClick}
                >
                  Quitar logo (usar iniciales)
                </Button>
              ) : null}
            </div>

            <p className="appearance-logo-block__help">
              Formatos permitidos: <strong>PNG, JPEG y WebP</strong> · Tamaño
              máximo: <strong>{MAX_LOGO_SIZE_LABEL}</strong>. El logotipo es
              temporal durante la sesión actual; si no hay logo activo se
              muestran las iniciales del negocio.
            </p>

            {logoError ? (
              <div className="settings-inline-error" role="alert">
                <strong>Archivo de logo rechazado:</strong> {logoError}
              </div>
            ) : null}
          </div>
        </div>

        {/* Bloque de Colores Hexadecimales */}
        <div className="appearance-colors-grid">
          <div className="color-field-card">
            <div className="color-field-card__picker-row">
              <label
                htmlFor={primaryPickerId}
                className="color-field-card__picker-label"
              >
                Selector de color principal
              </label>
              <input
                id={primaryPickerId}
                type="color"
                className="color-field-card__native-picker"
                value={pickerPrimaryValue}
                onChange={(event) =>
                  onChangeColor(
                    'primaryColor',
                    event.target.value.toUpperCase(),
                  )
                }
                aria-label="Selector visual de color principal"
              />
            </div>

            <Input
              label="Color principal (Hexadecimal) *"
              value={appearance.primaryColor}
              onChange={(event) =>
                onChangeColor('primaryColor', event.target.value)
              }
              placeholder="#8745E8"
              helpText={`Usado en botones principales, encabezados y acentos activos. Contraste actual con texto blanco: ${
                colorValidation.primaryWhiteContrast > 0
                  ? `${colorValidation.primaryWhiteContrast.toFixed(2)}:1`
                  : 'inválido'
              } (mínimo requerido: 3.50:1).`}
              error={colorValidation.primaryError}
              maxLength={7}
            />
          </div>

          <div className="color-field-card">
            <div className="color-field-card__picker-row">
              <label
                htmlFor={accentPickerId}
                className="color-field-card__picker-label"
              >
                Selector de color de acento
              </label>
              <input
                id={accentPickerId}
                type="color"
                className="color-field-card__native-picker"
                value={pickerAccentValue}
                onChange={(event) =>
                  onChangeColor('accentColor', event.target.value.toUpperCase())
                }
                aria-label="Selector visual de color de acento"
              />
            </div>

            <Input
              label="Color de acento (Hexadecimal) *"
              value={appearance.accentColor}
              onChange={(event) =>
                onChangeColor('accentColor', event.target.value)
              }
              placeholder="#13C8EE"
              helpText={`Usado en indicadores activos del menú lateral y bordes de avatar. Contraste sobre menú lateral (#101D46): ${
                colorValidation.accentSidebarContrast > 0
                  ? `${colorValidation.accentSidebarContrast.toFixed(2)}:1`
                  : 'inválido'
              } (mínimo requerido: 2.20:1).`}
              error={colorValidation.accentError}
              maxLength={7}
            />
          </div>
        </div>

        {/* Vista previa en vivo antes de guardar */}
        <div
          className="appearance-preview-box"
          aria-label="Vista previa de apariencia de la organización"
        >
          <div className="appearance-preview-box__header">
            <div>
              <h3 className="appearance-preview-box__title">
                Vista previa antes de guardar
              </h3>
              <p className="appearance-preview-box__subtitle">
                {colorValidation.isValid
                  ? 'La combinación cumple con el contraste mínimo y se previsualiza en tiempo real en el panel. Si descartas los cambios, se restaurará el tema guardado.'
                  : 'La combinación actual no cumple con las reglas de formato o contraste legible, por lo que no se aplica al panel.'}
              </p>
            </div>
            <Badge variant={colorValidation.isValid ? 'success' : 'danger'}>
              {colorValidation.isValid
                ? 'Contraste legible verificado'
                : 'Combinación bloqueada por legibilidad'}
            </Badge>
          </div>

          <div className="appearance-preview-stage">
            <div className="appearance-preview-sidebar">
              <div className="appearance-preview-sidebar__org">
                <OrganizationAvatar
                  organization={organization}
                  size="sm"
                  overrideLogoUrl={draftLogo.objectUrl}
                  overrideInitials={previewInitials}
                  overridePrimaryColor={previewTheme.primaryColor}
                  overrideAccentColor={previewTheme.accentColor}
                />
                <span className="appearance-preview-sidebar__org-name">
                  {previewCommercialName.trim() || organization.name}
                </span>
              </div>
              <div
                className="appearance-preview-sidebar__item"
                style={{
                  borderLeftColor: previewTheme.accentColor,
                }}
              >
                <span>Resumen</span>
                <span
                  className="appearance-preview-sidebar__pill"
                  style={{ backgroundColor: previewTheme.primaryColor }}
                >
                  Demo
                </span>
              </div>
            </div>

            <div
              className="appearance-preview-surface"
              style={{ borderTop: `3px solid ${previewTheme.primaryColor}` }}
            >
              <div className="appearance-preview-surface__row">
                <span className="appearance-preview-surface__title">
                  {previewCommercialName.trim() || organization.name}
                </span>
                <span
                  className="appearance-preview-surface__badge"
                  style={{
                    backgroundColor: previewTheme.primarySoftColor,
                    color: '#101D46',
                  }}
                >
                  Principal {previewTheme.primaryColor}
                </span>
              </div>
              <p className="appearance-preview-surface__text">
                Muestra de tarjeta operativa con botón de acción primaria y
                etiqueta de acento.
              </p>
              <div className="appearance-preview-surface__actions">
                <span
                  className="appearance-preview-surface__btn"
                  style={{ backgroundColor: previewTheme.primaryColor }}
                >
                  Acción principal
                </span>
                <span
                  className="appearance-preview-surface__accent-tag"
                  style={{
                    backgroundColor: previewTheme.accentSoftColor,
                    borderColor: previewTheme.accentColor,
                  }}
                >
                  Acento {previewTheme.accentColor}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Restablecer apariencia inicial con confirmación */}
        <div className="appearance-reset-bar">
          <div className="appearance-reset-bar__info">
            <span className="appearance-reset-bar__title">
              Apariencia inicial de fábrica para esta organización
            </span>
            <span className="appearance-reset-bar__desc">
              Color principal <code>{initialAppearance.primaryColor}</code> ·
              Color de acento <code>{initialAppearance.accentColor}</code> · Sin
              logotipo personalizado.
            </span>
          </div>

          {!showResetConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
            >
              Restablecer apariencia inicial
            </Button>
          ) : (
            <div
              className="appearance-reset-confirm"
              role="region"
              aria-label="Confirmación para restablecer apariencia inicial"
            >
              <span className="appearance-reset-confirm__text">
                ¿Restaurar colores originales y quitar el logo de sesión?
              </span>
              <div className="appearance-reset-confirm__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowResetConfirm(false)
                    setLogoError(null)
                    setLogoDimensions(null)
                    onConfirmResetAppearance()
                  }}
                >
                  Sí, restablecer apariencia
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

