import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BackroomViewer } from './BackroomViewer'
import './backroom.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackroomViewer />
  </StrictMode>,
)
