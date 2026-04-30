import { Navigate } from "react-router-dom";

export default function AuthGate({ children }) {
  const user = JSON.parse(sessionStorage.getItem("utenteLoggato"));

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}