import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const rootElement = document.getElementById('root')
class AppBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('Forma failed while rendering:', error) }
  render() {
    if (this.state.error) return <div className="boot-screen boot-error"><span className="boot-mark">forma<span>.</span></span><h1>The storefront could not start.</h1><p>{this.state.error.message}</p><small>Open DevTools → Console for the full error, then refresh after the fix.</small></div>
    return this.props.children
  }
}
try {
  createRoot(rootElement).render(<React.StrictMode><AppBoundary><App /></AppBoundary></React.StrictMode>)
  rootElement.dataset.appMounted = 'true'
} catch (error) {
  console.error('Forma failed to mount:', error)
  rootElement.innerHTML = `<div class="boot-screen boot-error"><span class="boot-mark">forma<span>.</span></span><h1>The storefront could not start.</h1><p>${String(error.message || error).replace(/[<>&]/g, '')}</p></div>`
}
