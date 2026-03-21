import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BackroomViewer } from './BackroomViewer'
import './backroom.css'

// Try to lock screen orientation to landscape on mobile
if (screen.orientation?.lock) {
  screen.orientation.lock('landscape').catch(() => {
    // Orientation lock requires fullscreen on most browsers; CSS fallback handles it
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackroomViewer />
  </StrictMode>,
)
