import { useId, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { Organization } from '../../../types'
import {
  defaultTicketConfigRepository,
  MAX_FOOTER_MESSAGE_LENGTH,
  MAX_HEADER_MESSAGE_LENGTH,
  MAX_RETURN_POLICY_LENGTH,
  sanitizeTicketText,
} from '../services/ticketConfigRepository'
import type {
  TicketConfig,
  TicketFontSize,
  TicketPaperWidth,
  TicketTemplateKind,
} from '../types'
import { getMockPreviewTicketSnapshot } from '../utils/ticketFormatting'
import { TicketModal } from './TicketModal'
import { TicketViewer } from './TicketViewer'

export interface TicketEditorPanelProps {
  organization: Organization
  onUnsavedChangesChange?: (hasChanges: boolean) => void
}

export function TicketEditorPanel({
  organization,
  onUnsavedChangesChange,
}: TicketEditorPanelProps) {
  const templateId = useId()
  const paperId = useId()
  const fontId = useId()
  const headerId = useId()
  const footerId = useId()
  const policyId = useId()

  const [savedConfig, setSavedConfig] = useState<TicketConfig>(() =>
    defaultTicketConfigRepository.load(organization.id),
  )

  const [draftConfig, setDraftConfig] = useState<TicketConfig>(savedConfig)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'warning'
    message: string
  } | null>(null)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isTestPrintModalOpen, setIsTestPrintModalOpen] = useState(false)

  // Comparación de cambios pendientes
  const hasChanges = useMemo(() => {
    return JSON.stringify(savedConfig) !== JSON.stringify(draftConfig)
  }, [savedConfig, draftConfig])

  // Notificar al contexto de cambios no guardados
  useState(() => {
    onUnsavedChangesChange?.(hasChanges)
  })

  const updateDraft = (updates: Partial<TicketConfig>) => {
    setDraftConfig((prev) => {
      const next = { ...prev, ...updates }
      onUnsavedChangesChange?.(
        JSON.stringify(savedConfig) !== JSON.stringify(next),
      )
      return next
    })
  }

  const handleSave = () => {
    const saved = defaultTicketConfigRepository.save(draftConfig)
    setSavedConfig(saved)
    setDraftConfig(saved)
    onUnsavedChangesChange?.(false)
    setFeedback({
      type: 'success',
      message:
        'Configuración de tickets guardada exitosamente para esta organización.',
    })
  }

  const handleDiscard = () => {
    setDraftConfig(savedConfig)
    onUnsavedChangesChange?.(false)
    setFeedback({
      type: 'info',
      message: 'Cambios descartados. Se restauró la última configuración guardada.',
    })
  }

  const handleConfirmReset = () => {
    const reset = defaultTicketConfigRepository.reset(organization.id)
    setSavedConfig(reset)
    setDraftConfig(reset)
    setIsResetConfirmOpen(false)
    onUnsavedChangesChange?.(false)
    setFeedback({
      type: 'info',
      message:
        'Plantilla restablecida a los valores iniciales recomendados para este negocio.',
    })
  }

  // Instantánea ficticia generada en tiempo real para la vista previa
  const previewSnapshot = useMemo(() => {
    return getMockPreviewTicketSnapshot(organization, draftConfig)
  }, [organization, draftConfig])

  return (
    <div className="ticket-editor-layout">
      {/* Columna izquierda / superior: Controles del editor */}
      <div className="ticket-editor-controls">
        <Card
          as="section"
          title="Plantilla e impresión de tickets"
          subtitle="Personaliza el diseño, formato de papel térmico y contenido de los comprobantes impresos."
          accentTop
          headerAction={
            hasChanges ? (
              <Badge variant="warning">Cambios sin guardar</Badge>
            ) : (
              <Badge variant="success">Guardado</Badge>
            )
          }
        >
          {feedback ? (
            <div
              className={`alert-banner alert-banner--${feedback.type} mb-4`}
              role="status"
            >
              <div className="alert-banner__content">
                <p>{feedback.message}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFeedback(null)}
              >
                Cerrar
              </Button>
            </div>
          ) : null}

          <form
            className="ticket-editor-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            {/* Tipo de plantilla y formato de papel */}
            <div className="form-group-row">
              <div className="form-field flex-1">
                <label htmlFor={templateId} className="form-label">
                  Estilo de plantilla
                </label>
                <select
                  id={templateId}
                  className="form-select"
                  value={draftConfig.templateKind}
                  onChange={(e) =>
                    updateDraft({
                      templateKind: e.target.value as TicketTemplateKind,
                    })
                  }
                >
                  <option value="compact">Compacta (líneas ágiles y ahorro de papel)</option>
                  <option value="detailed">Detallada (muestra SKU, desglose y destinos)</option>
                </select>
              </div>

              <div className="form-field flex-1">
                <label htmlFor={paperId} className="form-label">
                  Perfil de papel térmico
                </label>
                <select
                  id={paperId}
                  className="form-select"
                  value={draftConfig.paperWidth}
                  onChange={(e) =>
                    updateDraft({
                      paperWidth: e.target.value as TicketPaperWidth,
                    })
                  }
                >
                  <option value="80mm">80 mm (Estándar de mostrador / ~72 mm imprimibles)</option>
                  <option value="58mm">58 mm (Compacto / portátil / ~48 mm imprimibles)</option>
                </select>
              </div>
            </div>

            {/* Tamaño de texto */}
            <div className="form-field">
              <label htmlFor={fontId} className="form-label">
                Tamaño del texto impreso
              </label>
              <select
                id={fontId}
                className="form-select"
                value={draftConfig.fontSize}
                onChange={(e) =>
                  updateDraft({ fontSize: e.target.value as TicketFontSize })
                }
              >
                <option value="small">Pequeño (11 px · mayor densidad de texto)</option>
                <option value="normal">Normal (12 px · equilibrio estándar legible)</option>
                <option value="large">Grande (14 px · alta legibilidad en mostrador)</option>
              </select>
            </div>

            <div className="thermal-ticket__divider my-3" />

            {/* Opciones de inclusión */}
            <fieldset className="ticket-editor-options-fieldset">
              <legend className="form-label mb-2">Bloques informativos a incluir</legend>

              <div className="ticket-checkboxes-grid">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draftConfig.showLogo}
                    onChange={(e) => updateDraft({ showLogo: e.target.checked })}
                  />
                  <span>
                    <strong>Mostrar logotipo del negocio</strong>
                    <small className="text-muted block">
                      Apto para monocromático si está configurado en Apariencia.
                    </small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draftConfig.showAddressAndContact}
                    onChange={(e) =>
                      updateDraft({ showAddressAndContact: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Dirección y datos de contacto</strong>
                    <small className="text-muted block">
                      Teléfono, correo y domicilio registrados en Datos del negocio.
                    </small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draftConfig.showBranchRegisterOperator}
                    onChange={(e) =>
                      updateDraft({
                        showBranchRegisterOperator: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Sucursal, terminal y operador</strong>
                    <small className="text-muted block">
                      Identifica la caja de cobro y el cajero en turno.
                    </small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draftConfig.showSku}
                    onChange={(e) => updateDraft({ showSku: e.target.checked })}
                  />
                  <span>
                    <strong>Mostrar código SKU en partidas</strong>
                    <small className="text-muted block">
                      Útil para inventario y control de devoluciones.
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="thermal-ticket__divider my-3" />

            {/* Mensajes personalizados y políticas */}
            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor={headerId} className="form-label">
                  Mensaje superior de cortesía
                </label>
                <span className="text-muted text-xs">
                  {(draftConfig.headerMessage ?? '').length} / {MAX_HEADER_MESSAGE_LENGTH}
                </span>
              </div>
              <input
                id={headerId}
                type="text"
                className="form-input"
                maxLength={MAX_HEADER_MESSAGE_LENGTH}
                placeholder="Ej. ¡Gracias por apoyar el comercio local!"
                value={draftConfig.headerMessage ?? ''}
                onChange={(e) =>
                  updateDraft({
                    headerMessage: sanitizeTicketText(
                      e.target.value,
                      MAX_HEADER_MESSAGE_LENGTH,
                    ),
                  })
                }
              />
            </div>

            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor={footerId} className="form-label">
                  Mensaje de pie de ticket
                </label>
                <span className="text-muted text-xs">
                  {(draftConfig.footerMessage ?? '').length} / {MAX_FOOTER_MESSAGE_LENGTH}
                </span>
              </div>
              <input
                id={footerId}
                type="text"
                className="form-input"
                maxLength={MAX_FOOTER_MESSAGE_LENGTH}
                placeholder="Ej. Conserve su ticket para cualquier duda o aclaración."
                value={draftConfig.footerMessage ?? ''}
                onChange={(e) =>
                  updateDraft({
                    footerMessage: sanitizeTicketText(
                      e.target.value,
                      MAX_FOOTER_MESSAGE_LENGTH,
                    ),
                  })
                }
              />
            </div>

            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor={policyId} className="form-label">
                  Políticas y condiciones de devolución
                </label>
                <span className="text-muted text-xs">
                  {(draftConfig.returnPolicy ?? '').length} / {MAX_RETURN_POLICY_LENGTH}
                </span>
              </div>
              <textarea
                id={policyId}
                rows={3}
                className="form-textarea"
                maxLength={MAX_RETURN_POLICY_LENGTH}
                placeholder="Ej. Devoluciones dentro de los 7 días naturales con comprobante en mano..."
                value={draftConfig.returnPolicy ?? ''}
                onChange={(e) =>
                  updateDraft({
                    returnPolicy: sanitizeTicketText(
                      e.target.value,
                      MAX_RETURN_POLICY_LENGTH,
                    ),
                  })
                }
              />
            </div>

            {/* Acciones principales del editor */}
            <div className="ticket-editor-actions">
              <div className="ticket-editor-actions__primary">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!hasChanges}
                >
                  Guardar cambios
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasChanges}
                  onClick={handleDiscard}
                >
                  Descartar
                </Button>
              </div>

              <div className="ticket-editor-actions__secondary">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsTestPrintModalOpen(true)}
                >
                  Imprimir prueba
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsResetConfirmOpen(true)}
                >
                  Restablecer plantilla
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>

      {/* Columna derecha / inferior: Vista previa en vivo */}
      <div className="ticket-editor-preview-column">
        <div className="ticket-preview-card">
          <div className="ticket-preview-card__header">
            <div>
              <h3 className="ticket-preview-card__title">
                Vista previa en vivo
              </h3>
              <p className="ticket-preview-card__subtitle">
                Simulación del rollo de {draftConfig.paperWidth} con datos de muestra
              </p>
            </div>
            <Badge variant="neutral">Datos ficticios</Badge>
          </div>

          <div className="ticket-preview-card__stage">
            <TicketViewer
              snapshot={previewSnapshot}
              overrideLogoUrl={organization.logo?.objectUrl}
            />
          </div>
        </div>
      </div>

      {/* Modal de confirmación para restablecer */}
      {isResetConfirmOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsResetConfirmOpen(false)}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-dialog__title">
              ¿Restablecer plantilla de tickets?
            </h3>
            <p className="modal-dialog__description">
              Se restaurarán los valores predeterminados de diseño, formato y mensajes de cortesía para <strong>{organization.name}</strong>. Las ventas anteriores y comprobantes ya emitidos conservarán su formato histórico original.
            </p>
            <div className="modal-dialog__actions">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmReset}
              >
                Confirmar restablecimiento
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetConfirmOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Impresión de Prueba */}
      {isTestPrintModalOpen ? (
        <TicketModal
          snapshot={previewSnapshot}
          operatorName="Operador de Demostración"
          onClose={() => setIsTestPrintModalOpen(false)}
        />
      ) : null}
    </div>
  )
}

