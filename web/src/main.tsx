import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/limelight/400.css';
import './styles.css';

// Surface CSP blocks explicitly. The security headers only apply in
// production, so a policy that is too strict shows up as vague playback
// failures with nothing obvious in the console.
document.addEventListener('securitypolicyviolation', (e) => {
  console.error(
    `[CSP BLOCKED] ${e.effectiveDirective} blocked ${e.blockedURI || '(inline)'}`,
    e,
  );
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
