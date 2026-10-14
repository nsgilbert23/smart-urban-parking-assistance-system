import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function OperatorRoute({ children }) {
  const { user } = useAuth();

  if (!user || !["OPERATOR", "ADMIN"].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
