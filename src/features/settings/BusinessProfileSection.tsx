import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { BusinessProfileSettings } from '../../types'
import type { BusinessProfileErrors } from './validation'

export interface BusinessProfileSectionProps {
  values: BusinessProfileSettings
  errors: BusinessProfileErrors
  isDirty: boolean
  onChangeField: (
    field: keyof BusinessProfileSettings,
    value: string,
  ) => void
}

export function BusinessProfileSection({
  values,
  errors,
  isDirty,
  onChangeField,
}: BusinessProfileSectionProps) {
  return (
    <Card
      as="section"
      title="1. Datos del negocio"
      subtitle="Información comercial que identifica a la organización en el panel y encabezados de operación"
      headerAction={
        isDirty ? (
          <Badge variant="warning">Cambios sin guardar</Badge>
        ) : (
          <Badge variant="neutral">Al día</Badge>
        )
      }
    >
      <div className="settings-form-grid">
        <div className="settings-form-grid__full">
          <Input
            label="Nombre comercial *"
            value={values.commercialName}
            onChange={(event) =>
              onChangeField('commercialName', event.target.value)
            }
            placeholder="Ej. Papelería y Regalos Luna"
            helpText="Obligatorio (2 a 80 caracteres). Al guardar actualiza el nombre e iniciales del negocio en todo el panel."
            error={errors.commercialName}
            maxLength={85}
            required
          />
        </div>

        <Input
          label="Teléfono de contacto"
          type="tel"
          value={values.phone}
          onChange={(event) => onChangeField('phone', event.target.value)}
          placeholder="Ej. +52 55 4162 8890"
          helpText="Opcional. Entre 7 y 15 dígitos (permite +, espacios, guiones y paréntesis)."
          error={errors.phone}
          maxLength={25}
        />

        <Input
          label="Correo electrónico comercial"
          type="email"
          value={values.email}
          onChange={(event) => onChangeField('email', event.target.value)}
          placeholder="Ej. contacto@minegocio.com"
          helpText="Opcional. Correo visible en datos del comercio (máximo 100 caracteres)."
          error={errors.email}
          maxLength={105}
        />

        <div className="settings-form-grid__full">
          <Input
            label="Dirección física / sucursal"
            value={values.address}
            onChange={(event) => onChangeField('address', event.target.value)}
            placeholder="Ej. Av. Juárez 142, Col. Centro, Ciudad de México"
            helpText="Opcional. Entre 5 y 180 caracteres para referencia en tickets y reportes."
            error={errors.address}
            maxLength={190}
          />
        </div>

        <div className="settings-form-grid__full">
          <Input
            label="Sitio web"
            type="url"
            value={values.website}
            onChange={(event) => onChangeField('website', event.target.value)}
            placeholder="Ej. https://minegocio.com"
            helpText="Opcional. Debe incluir http:// o https:// y un dominio válido."
            error={errors.website}
            maxLength={160}
          />
        </div>
      </div>
    </Card>
  )
}

