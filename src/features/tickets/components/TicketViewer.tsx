import { useEffect, useState } from 'react'
import { getDurableLogoObjectUrl } from '../services/durableLogoStorage'
import type { TicketSnapshot } from '../types'
import {
  formatTicketDateTime,
  formatTicketMoney,
  getDocumentTypePresentation,
} from '../utils/ticketFormatting'

export interface TicketViewerProps {
  snapshot: TicketSnapshot
  isReprint?: boolean
  reprintOperator?: string
  className?: string
  overrideLogoUrl?: string | null
}

export function TicketViewer({
  snapshot,
  isReprint = false,
  reprintOperator,
  className = '',
  overrideLogoUrl,
}: TicketViewerProps) {
  const {
    configSnapshot,
    businessProfileSnapshot,
    lines,
    currency,
    timezone,
    dateFormat,
    documentType,
  } = snapshot

  const [asyncLogoUrl, setAsyncLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (overrideLogoUrl || !configSnapshot.showLogo || !snapshot.logoStorageKey) {
      return
    }

    let isMounted = true
    getDurableLogoObjectUrl(snapshot.logoStorageKey).then((url) => {
      if (isMounted) {
        setAsyncLogoUrl(url)
      }
    })

    return () => {
      isMounted = false
    }
  }, [snapshot.logoStorageKey, configSnapshot.showLogo, overrideLogoUrl])

  const effectiveLogoUrl =
    overrideLogoUrl ??
    (configSnapshot.showLogo && snapshot.logoStorageKey ? asyncLogoUrl : null)

  const docPres = getDocumentTypePresentation(documentType)
  const dt = formatTicketDateTime(snapshot.createdAt, timezone, dateFormat)

  const isDetailed = configSnapshot.templateKind === 'detailed'
  const is58mm = configSnapshot.paperWidth === '58mm'
  const fontSizeClass = `thermal-ticket--font-${configSnapshot.fontSize || 'normal'}`
  const paperClass = is58mm ? 'thermal-ticket--58mm' : 'thermal-ticket--80mm'

  return (
    <article
      className={`thermal-ticket ${paperClass} ${fontSizeClass} ${className}`}
      aria-label={`${docPres.headerTitle} ${snapshot.ticketFolio}`}
    >
      {/* Banner de Reimpresión / Copia */}
      {isReprint || snapshot.reprintAuditTrail.length > 0 ? (
        <div className="thermal-ticket__reprint-banner" role="status">
          <strong>*** COPIA / REIMPRESIÓN ***</strong>
          <small>
            Reimpreso por: {reprintOperator || snapshot.operatorName} ·{' '}
            {formatTicketDateTime(new Date().toISOString(), timezone, dateFormat).fullLabel}
          </small>
        </div>
      ) : null}

      {/* Nota de comprobante reconstruido para ventas anteriores a esta fase */}
      {snapshot.isReconstructed ? (
        <div className="thermal-ticket__reconstructed-note" role="note">
          <small>
            [Comprobante reconstruido de venta previa al sistema de plantillas]
          </small>
        </div>
      ) : null}

      {/* Cabecera del negocio */}
      <header className="thermal-ticket__header">
        {configSnapshot.showLogo && effectiveLogoUrl ? (
          <div className="thermal-ticket__logo-box">
            <img
              src={effectiveLogoUrl}
              alt={`Logotipo de ${businessProfileSnapshot.commercialName}`}
              className="thermal-ticket__logo"
            />
          </div>
        ) : null}

        <h1 className="thermal-ticket__business-name">
          {businessProfileSnapshot.commercialName}
        </h1>

        {configSnapshot.showAddressAndContact ? (
          <div className="thermal-ticket__contact-info">
            {businessProfileSnapshot.address ? (
              <p>{businessProfileSnapshot.address}</p>
            ) : null}
            {businessProfileSnapshot.phone ? (
              <p>Tel: {businessProfileSnapshot.phone}</p>
            ) : null}
            {businessProfileSnapshot.email ? (
              <p>Email: {businessProfileSnapshot.email}</p>
            ) : null}
            {businessProfileSnapshot.website ? (
              <p>{businessProfileSnapshot.website}</p>
            ) : null}
          </div>
        ) : null}

        {configSnapshot.headerMessage ? (
          <p className="thermal-ticket__custom-header-msg">
            {configSnapshot.headerMessage}
          </p>
        ) : null}

        <div className="thermal-ticket__divider" />

        <div className="thermal-ticket__doc-title">
          <strong>{docPres.headerTitle}</strong>
        </div>

        <div className="thermal-ticket__meta-grid">
          <div className="thermal-ticket__meta-row">
            <span>Folio comprobante:</span>
            <strong>{snapshot.ticketFolio}</strong>
          </div>
          <div className="thermal-ticket__meta-row">
            <span>Fecha y hora:</span>
            <span>{dt.fullLabel}</span>
          </div>

          {snapshot.saleFolio ? (
            <div className="thermal-ticket__meta-row">
              <span>Folio de venta:</span>
              <strong>{snapshot.saleFolio}</strong>
            </div>
          ) : null}

          {configSnapshot.showBranchRegisterOperator ? (
            <>
              <div className="thermal-ticket__meta-row">
                <span>Sucursal:</span>
                <span>{snapshot.branchName}</span>
              </div>
              <div className="thermal-ticket__meta-row">
                <span>Caja / Terminal:</span>
                <span>
                  {snapshot.registerName} ({snapshot.registerCode})
                </span>
              </div>
              <div className="thermal-ticket__meta-row">
                <span>Atendió:</span>
                <span>{snapshot.operatorName}</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Motivo de devolución / cancelación si aplica */}
        {snapshot.returnReason ? (
          <div className="thermal-ticket__reason-box">
            <span>Motivo de la operación:</span>
            <p>&quot;{snapshot.returnReason}&quot;</p>
          </div>
        ) : null}
      </header>

      <div className="thermal-ticket__divider" />

      {/* Partidas */}
      <section
        className="thermal-ticket__items-section"
        aria-label="Partidas del comprobante"
      >
        <div className="thermal-ticket__items-header">
          <span className="thermal-ticket__col-desc">Descripción</span>
          <span className="thermal-ticket__col-qty">Cant.</span>
          <span className="thermal-ticket__col-total">Total</span>
        </div>

        <div className="thermal-ticket__divider thermal-ticket__divider--thin" />

        <div className="thermal-ticket__items-list">
          {lines.map((item, idx) => (
            <div
              key={`${item.saleLineId}-${idx}`}
              className="thermal-ticket__item-row"
            >
              <div className="thermal-ticket__item-main">
                <span className="thermal-ticket__item-name">
                  {item.productName}
                </span>

                {isDetailed && (configSnapshot.showSku || item.destination) ? (
                  <div className="thermal-ticket__item-details">
                    {configSnapshot.showSku && item.sku ? (
                      <small className="thermal-ticket__item-sku">
                        SKU: {item.sku}
                      </small>
                    ) : null}
                    {item.destination ? (
                      <small className="thermal-ticket__item-dest">
                        Destino:{' '}
                        {item.destination === 'sellable'
                          ? 'Reingreso vendible'
                          : 'Merma / daño'}
                      </small>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="thermal-ticket__item-qty">
                {item.quantity} {item.unit}
                {isDetailed && item.unitPriceCents > 0 ? (
                  <small className="thermal-ticket__item-unit-price">
                    @ {formatTicketMoney(item.unitPriceCents, currency)}
                  </small>
                ) : null}
              </div>

              <div className="thermal-ticket__item-total">
                {formatTicketMoney(item.lineSubtotalCents, currency)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="thermal-ticket__divider" />

      {/* Totales y Pago */}
      <footer className="thermal-ticket__footer">
        <div className="thermal-ticket__totals-box">
          <div className="thermal-ticket__total-row thermal-ticket__total-row--grand">
            <span>
              {documentType === 'sale_ticket'
                ? 'TOTAL'
                : 'TOTAL REEMBOLSADO'}
            </span>
            <strong>
              {formatTicketMoney(snapshot.totalCents, currency)} {currency}
            </strong>
          </div>

          <div className="thermal-ticket__divider thermal-ticket__divider--thin" />

          <div className="thermal-ticket__payment-rows">
            <div className="thermal-ticket__meta-row">
              <span>Forma de pago:</span>
              <strong>
                {snapshot.paymentMethod === 'cash'
                  ? 'Efectivo'
                  : snapshot.paymentMethod === 'card'
                    ? 'Tarjeta (manual)'
                    : 'Transferencia (manual)'}
              </strong>
            </div>

            {snapshot.paymentMethod === 'cash' ? (
              <>
                <div className="thermal-ticket__meta-row">
                  <span>Efectivo entregado:</span>
                  <span>
                    {formatTicketMoney(
                      snapshot.cashReceivedCents ?? snapshot.totalCents,
                      currency,
                    )}
                  </span>
                </div>
                <div className="thermal-ticket__meta-row">
                  <span>Cambio:</span>
                  <span>
                    {formatTicketMoney(
                      snapshot.cashChangeCents ?? 0,
                      currency,
                    )}
                  </span>
                </div>
              </>
            ) : null}

            {snapshot.externalReference ? (
              <div className="thermal-ticket__meta-row">
                <span>Referencia:</span>
                <span>{snapshot.externalReference}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Políticas y pie de página */}
        {configSnapshot.footerMessage ? (
          <p className="thermal-ticket__custom-footer-msg">
            {configSnapshot.footerMessage}
          </p>
        ) : null}

        {configSnapshot.returnPolicy ? (
          <div className="thermal-ticket__return-policy">
            <span className="thermal-ticket__return-policy-title">
              Políticas de Devolución:
            </span>
            <p>{configSnapshot.returnPolicy}</p>
          </div>
        ) : null}

        <div className="thermal-ticket__divider" />

        <p className="thermal-ticket__system-tag">
          Nedaxoli Control · Comprobante simplificado
        </p>
      </footer>
    </article>
  )
}
