// src/components/ui/ActionButton.jsx
// Pulsante unico per tutta l'app. Varianti: primary (blu), admin (grigio), danger (rosso).
import React from "react";

const ActionButton = ({ variant = "primary", compact = false, className = "", children, ...rest }) => {
  const classes = [
    "mf-btn",
    variant !== "primary" && `mf-btn--${variant}`,
    compact && "mf-btn--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
};

export default ActionButton;
