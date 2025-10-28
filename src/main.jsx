import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// This standard file initializes the React application.
// It tells React to render the main <App /> component into the HTML element
// with the ID 'root' (which is defined in index.html).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)