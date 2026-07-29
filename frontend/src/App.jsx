import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Calendar from "./pages/Calendar.jsx";
import Profile from "./pages/Profile.jsx";
import Notifications from "./pages/Notifications.jsx";
import TitleDetail from "./pages/TitleDetail.jsx";
import UpdateHistory from "./pages/UpdateHistory.jsx";

const PrivateRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  return token ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  return !token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="updates" element={<Notifications />} />
        <Route path="titles/:id" element={<TitleDetail />} />
        <Route path="updates/:titleId/history" element={<UpdateHistory />} />

      </Route>
    </Routes>
  );
}

export default App;
