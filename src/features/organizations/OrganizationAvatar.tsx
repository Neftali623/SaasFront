import type { Organization } from '../../types'

export interface OrganizationAvatarProps {
  organization: Organization
  size?: 'sm' | 'md' | 'lg'
  overrideLogoUrl?: string | null
  overrideInitials?: string
  overridePrimaryColor?: string
  overrideAccentColor?: string
  className?: string
}

export function OrganizationAvatar({
  organization,
  size = 'md',
  overrideLogoUrl,
  overrideInitials,
  overridePrimaryColor,
  overrideAccentColor,
  className = '',
}: OrganizationAvatarProps) {
  const logoUrl =
    overrideLogoUrl !== undefined
      ? overrideLogoUrl
      : organization.logo.objectUrl
  const initials = overrideInitials ?? organization.initials
  const primaryColor = overridePrimaryColor ?? organization.primaryColor
  const accentColor = overrideAccentColor ?? organization.accentColor

  const classes = [
    'org-avatar',
    `org-avatar--${size}`,
    logoUrl ? 'org-avatar--has-logo' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      style={{
        backgroundColor: logoUrl ? '#FFFFFF' : primaryColor,
        borderColor: accentColor,
      }}
      aria-hidden="true"
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="org-avatar__img"
        />
      ) : (
        <span className="org-avatar__initials">{initials}</span>
      )}
    </div>
  )
}

