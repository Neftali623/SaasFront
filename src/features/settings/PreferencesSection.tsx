import { useId } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type {
  CurrencyCode,
  DateFormatOption,
  OrganizationPreferences,
  TimezoneOption,
} from '../../types'
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  formatAmountByCurrency,
  formatDateByPreference,
  getTimezoneShortLabel,
  TIMEZONE_OPTIONS,
} from './formatters'

export interface PreferencesSectionProps {
  values: OrganizationPreferences
  isDirty: boolean
  onChangePreference: <K extends keyof OrganizationPreferences>(
    field: K,
    value: OrganizationPreferences[K],
  ) => void
}

export function PreferencesSection({
  values,
  isDirty,
  onChangePreference,
}: PreferencesSectionProps) {
  const currencyId = useId()
  const timezoneId = useId()
  const dateFormatId = useId()

  const sampleAmountFormatted = formatAmountByCurrency(4860, values.currency)
  const sampleDateFormatted = formatDateByPreference(
    '2026-11-02',
    values.dateFormat,
  )
  const sampleTimezoneLabel = getTimezoneShortLabel(values.timezone)

  return (
    <Card
      as="section"
      title="3. Preferencias de visualización"
      subtitle="Ajustes regionales de formato para importes, fechas y zona horaria en la demostración"
      headerAction={
        isDirty ? (
          <Badge variant="warning">Cambios sin guardar</Badge>
        ) : (
          <Badge variant="neutral">Al día</Badge>
        )
      }
    >
      <div className="preferences-section-stack">
        <div className="settings-select-grid">
          <div className="ui-select-field">
            <label htmlFor={currencyId} className="ui-input__label">
              Moneda de visualización
            </label>
            <select
              id={currencyId}
              className="ui-select-field__control"
              value={values.currency}
              onChange={(event) =>
                onChangePreference(
                  'currency',
                  event.target.value as CurrencyCode,
                )
              }
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="ui-input__help">
              Cambia el símbolo y código al mostrar importes.{' '}
              <strong>No realiza conversión de divisas</strong> ni modifica
              importes numéricos.
            </p>
          </div>

          <div className="ui-select-field">
            <label htmlFor={timezoneId} className="ui-input__label">
              Zona horaria operativa
            </label>
            <select
              id={timezoneId}
              className="ui-select-field__control"
              value={values.timezone}
              onChange={(event) =>
                onChangePreference(
                  'timezone',
                  event.target.value as TimezoneOption,
                )
              }
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="ui-input__help">
              Referencia horaria para cortes de caja y encabezados del resumen
              operativo.
            </p>
          </div>

          <div className="ui-select-field">
            <label htmlFor={dateFormatId} className="ui-input__label">
              Formato de fecha
            </label>
            <select
              id={dateFormatId}
              className="ui-select-field__control"
              value={values.dateFormat}
              onChange={(event) =>
                onChangePreference(
                  'dateFormat',
                  event.target.value as DateFormatOption,
                )
              }
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="ui-input__help">
              Orden en que se presentan día, mes y año en tickets y listados del
              panel.
            </p>
          </div>
        </div>

        <div
          className="preferences-sample-box"
          role="region"
          aria-label="Muestra de formato con preferencias seleccionadas"
        >
          <div className="preferences-sample-box__item">
            <span className="preferences-sample-box__label">
              Muestra de importe (monto base 4860):
            </span>
            <strong className="preferences-sample-box__value">
              {sampleAmountFormatted}
            </strong>
          </div>
          <div className="preferences-sample-box__item">
            <span className="preferences-sample-box__label">
              Muestra de fecha y corte:
            </span>
            <strong className="preferences-sample-box__value">
              {sampleDateFormatted} · 13:40 h ({sampleTimezoneLabel})
            </strong>
          </div>
        </div>
      </div>
    </Card>
  )
}

