import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { login } from "../features/authSlice.js";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import toast from "react-hot-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      toast.success("Logged in successfully");
    } else {
      toast.error(result.payload);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="logo">WatchPulse</div>
        <p className="subtitle">Welcome back</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ position: "relative" }}>
            <label>Password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: "2.75rem" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "0.75rem",
                top: "2.1rem",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                padding: "0.25rem",
                display: "flex",
              }}
            >
              {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.75rem", padding: "0.75rem" }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ fontWeight: 600 }}>Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
