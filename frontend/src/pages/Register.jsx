import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { register } from "../features/authSlice.js";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import toast from "react-hot-toast";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    const result = await dispatch(register({ username, email, password }));
    if (register.fulfilled.match(result)) {
      toast.success("Account created successfully");
    } else {
      toast.error(result.payload);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="logo">WatchPulse</div>
        <p className="subtitle">Create your account</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>
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
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.75rem", padding: "0.75rem" }}
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
