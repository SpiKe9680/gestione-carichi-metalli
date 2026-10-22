// src/components/layout/PageLayout.jsx
// Componente solo grafico: nessuna logica, nessuna chiamata al backend.
import React from "react";
import "../../styles/theme.css";
import "../../styles/layout.css";

const PageLayout = ({ title, logoBase64, headerActions = null, maxWidth = 760, children }) => {
  return (
    <div className="mf-page" style={{ "--mf-page-max": `${maxWidth}px` }}>
      <header className="mf-header">
        <div className="mf-brand">
          {logoBase64 && (
            <img
              src={`data:image/png;base64,${logoBase64}`}
              alt="Logo METALFLOW"
              className="mf-logo"
            />
          )}
          <h2 className="mf-title">{title}</h2>
        </div>

        {headerActions && <div className="mf-header-actions">{headerActions}</div>}
      </header>

      {children}
    </div>
  );
};

export default PageLayout;
