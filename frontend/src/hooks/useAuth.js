import { useContext } from "react";
import { AuthContext } from "../context/authContextValue";

export default function useAuth() {
  return useContext(AuthContext);
}
