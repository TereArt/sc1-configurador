import './lib/diag.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { useStore } from './store.js';
window.__sc1store = useStore;
import { motion } from './lib/cloth.js';
window.__sc1ang = (a) => { motion.goal = a; };
import { texCanvas } from './lib/texture.js';
window.__sc1tex = texCanvas;
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
