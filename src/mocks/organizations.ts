import { buildThemeFromColors, computeInitials } from '../features/settings/colorUtils'
import type {
  DemoUser,
  Organization,
  SerializableOrganizationSettings,
} from '../types'

export const DEFAULT_DEMO_USER: DemoUser = {
  name: 'Operador de Demostración',
  role: 'Vista previa sin sesión real',
  emailPreview: 'demo@nedaxoli.local',
}

const LUNA_INITIAL_SETTINGS: SerializableOrganizationSettings = {
  businessProfile: {
    commercialName: 'Papelería y Regalos Luna',
    phone: '+52 55 4162 8890',
    email: 'contacto@papelerialuna.demo',
    address: 'Av. Juárez 142, Col. Centro, Ciudad de México',
    website: 'https://papelerialuna.demo',
  },
  appearance: {
    primaryColor: '#8745E8',
    accentColor: '#13C8EE',
  },
  preferences: {
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    dateFormat: 'DD/MM/YYYY',
  },
}

const FARO_INITIAL_SETTINGS: SerializableOrganizationSettings = {
  businessProfile: {
    commercialName: 'Cafetería y Panadería El Faro',
    phone: '+52 81 8345 1920',
    email: 'hola@cafeteriaelfaro.demo',
    address: 'Calle Hidalgo 308, Zona Alameda, Monterrey',
    website: 'https://cafeteriaelfaro.demo',
  },
  appearance: {
    primaryColor: '#0F766E',
    accentColor: '#D97706',
  },
  preferences: {
    currency: 'MXN',
    timezone: 'America/Monterrey',
    dateFormat: 'DD/MM/YYYY',
  },
}

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-papeleria-luna',
    name: LUNA_INITIAL_SETTINGS.businessProfile.commercialName,
    initials: computeInitials(
      LUNA_INITIAL_SETTINGS.businessProfile.commercialName,
      'PL',
    ),
    category: 'Papelería, artículos escolares y novedades',
    branchName: 'Sucursal Centro',
    primaryColor: LUNA_INITIAL_SETTINGS.appearance.primaryColor,
    accentColor: LUNA_INITIAL_SETTINGS.appearance.accentColor,
    theme: buildThemeFromColors(
      LUNA_INITIAL_SETTINGS.appearance.primaryColor,
      LUNA_INITIAL_SETTINGS.appearance.accentColor,
    ),
    businessProfile: { ...LUNA_INITIAL_SETTINGS.businessProfile },
    preferences: { ...LUNA_INITIAL_SETTINGS.preferences },
    logo: {
      objectUrl: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
    },
    initialSettings: LUNA_INITIAL_SETTINGS,
    updatedAt: null,
  },
  {
    id: 'org-cafeteria-faro',
    name: FARO_INITIAL_SETTINGS.businessProfile.commercialName,
    initials: computeInitials(
      FARO_INITIAL_SETTINGS.businessProfile.commercialName,
      'CF',
    ),
    category: 'Cafetería, barra de espresso y pan artesanal',
    branchName: 'Sucursal Alameda',
    primaryColor: FARO_INITIAL_SETTINGS.appearance.primaryColor,
    accentColor: FARO_INITIAL_SETTINGS.appearance.accentColor,
    theme: buildThemeFromColors(
      FARO_INITIAL_SETTINGS.appearance.primaryColor,
      FARO_INITIAL_SETTINGS.appearance.accentColor,
    ),
    businessProfile: { ...FARO_INITIAL_SETTINGS.businessProfile },
    preferences: { ...FARO_INITIAL_SETTINGS.preferences },
    logo: {
      objectUrl: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
    },
    initialSettings: FARO_INITIAL_SETTINGS,
    updatedAt: null,
  },
]
