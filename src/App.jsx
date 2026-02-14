import { BrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { AuthProvider } from './contexts/AuthContext'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollProgress />
        <Layout />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
