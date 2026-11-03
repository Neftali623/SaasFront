export interface BrandMarkProps {
  variant?: 'light' | 'dark'
  subtitle?: string
}

/**
 * Identificador tipográfico provisional de Nedaxoli Control.
 * No utiliza imágenes inventadas ni rutas externas.
 */
export function BrandMark({
  variant = 'dark',
  subtitle = 'Control comercial',
}: BrandMarkProps) {
  return (
    <div className={`brand-mark brand-mark--${variant}`}>
      <div className="brand-mark__monogram" aria-hidden="true">
        <span className="brand-mark__letters">NX</span>
        <span className="brand-mark__dot" />
      </div>
      <div className="brand-mark__text">
        <span className="brand-mark__name">Nedaxoli Control</span>
        {subtitle ? <span className="brand-mark__subtitle">{subtitle}</span> : null}
      </div>
    </div>
  )
}

