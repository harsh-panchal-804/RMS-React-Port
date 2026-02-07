import { BrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
