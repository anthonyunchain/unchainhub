import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Google Translate (and similar extensions) replace DOM text nodes with <font>
// wrappers, so React's removeChild/insertBefore throw NotFoundError and crash
// the whole app (facebook/react#11538). Make both tolerant of moved nodes.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      return child
    }
    return originalRemoveChild.apply(this, arguments)
  }
  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return originalInsertBefore.apply(this, arguments)
  }
}

// Register service worker for PWA + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
