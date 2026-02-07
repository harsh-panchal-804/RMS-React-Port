import { BrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toaster } from '@/components/ui/sonner'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Layout />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
