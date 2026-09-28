import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { ShopProvider } from './context/ShopContext.jsx';
import { SiteProvider } from './context/SiteContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <ShopProvider>
            <SiteProvider>
              <App />
            </SiteProvider>
          </ShopProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);