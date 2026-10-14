import { Routes, Route } from "react-router-dom";

import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Home from "../pages/Home/Home";
import Dashboard from "../pages/Dashboard/Dashboard";
import Vehicles from "../pages/Vehicles/Vehicles";
import Parking from "../pages/Parking/Parking";
import ParkingSessions from "../pages/ParkingSessions/ParkingSessions";
import ParkingHistory from "../pages/ParkingHistory/ParkingHistory";
import Profile from "../pages/Profile/Profile";
import Notifications from "../pages/Notifications/Notifications";
import OperatorDashboard from "../pages/OperatorDashboard/OperatorDashboard";
import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";
import ReportsAnalytics from "../pages/ReportsAnalytics/ReportsAnalytics";
import NotFound from "../pages/NotFound/NotFound";
import AuthenticatedLayout from "../layouts/AuthenticatedLayout";

import ProtectedRoute from "./ProtectedRoute";
import OperatorRoute from "./OperatorRoute";
import AdminRoute from "./AdminRoute";

export default function AppRoutes() {
  return (
    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/parking" element={<Parking />} />
        <Route path="/parking-sessions" element={<ParkingSessions />} />
        <Route
          path="/operator-dashboard"
          element={<OperatorRoute><OperatorDashboard /></OperatorRoute>}
        />
        <Route
          path="/admin-dashboard"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/reports-analytics"
          element={<AdminRoute><ReportsAnalytics /></AdminRoute>}
        />
        <Route path="/parking-history" element={<ParkingHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      <Route path="*" element={<NotFound />} />

    </Routes>
  );
}
