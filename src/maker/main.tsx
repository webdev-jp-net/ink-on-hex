import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/font'
import '@/styles/index.scss'
import { Maker } from './Maker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Maker />
  </StrictMode>
)
