/**
 * Main entry point for the React application.
 * 
 * This file initializes the React application and mounts it to the DOM.
 * React.StrictMode is enabled to help identify potential problems during development.
 * 
 * The root element is expected to exist in index.html with id="root".
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Mount the React application to the root DOM element
// Using createRoot API (React 18+) for concurrent rendering support
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
