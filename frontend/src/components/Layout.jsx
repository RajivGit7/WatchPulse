import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../features/authSlice.js";
import { HiOutlineBell, HiMenu, HiX } from "react-icons/hi";
import {
  HiOutlineHome,
  HiOutlineCollection,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineLogout,
} from "react-icons/hi";

const Layout = () => {
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: "/", icon: HiOutlineHome, label: "Dashboard" },
    { to: "/watchlist", icon: HiOutlineCollection, label: "Watchlist" },
    { to: "/calendar", icon: HiOutlineCalendar, label: "Calendar" },
    { to: "/updates", icon: HiOutlineBell, label: "Updates" },
    { to: "/profile", icon: HiOutlineUser, label: "Profile" },
  ];

  return (
    <div className="app-layout">
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <HiX size={24} /> : <HiMenu size={24} />}
        </button>
        <span
          style={{
            fontWeight: 800,
            fontSize: "1.1rem",
            background: "linear-gradient(135deg, var(--accent), #ff6b8a)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          WatchPulse
        </span>
        <div style={{ width: 36 }} />
      </header>

      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="logo">WatchPulse</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => dispatch(logout())}
          >
            <HiOutlineLogout size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
