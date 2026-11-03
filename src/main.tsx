import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { DemoOrganizationProvider } from './features/organizations/DemoOrganizationProvider'
import './styles/variables.css'
import './styles/global.css'
import './features/tickets/styles/tickets.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DemoOrganizationProvider>
        <App />
      </DemoOrganizationProvider>
    </BrowserRouter>
  </StrictMode>,
)
