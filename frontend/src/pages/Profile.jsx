import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "../features/authSlice.js";
import { HiOutlineCamera, HiOutlinePencil, HiOutlineX, HiOutlineCheck, HiOutlineClock, HiOutlineFilm, HiOutlineVideoCamera, HiOutlineSparkles } from "react-icons/hi";
import api from "../services/api.js";
import toast from "react-hot-toast";

const AVATAR_MAX_SIZE = 500 * 1024;

const formatMemberSince = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const Profile = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ anime: 0, movie: 0, tv: 0, total: 0 });
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get("/users/profile");
        setProfileData(data);
        if (data.avatar && data.avatar !== user?.avatar) {
          dispatch(updateUser({ avatar: data.avatar }));
        }
      } catch {}
    };
    fetchProfile();

    const fetchStats = async () => {
      try {
        const { data } = await api.get("/users/profile/stats");
        setStats(data);
      } catch {}
    };
    fetchStats();
  }, [dispatch, user?.avatar]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > AVATAR_MAX_SIZE) {
      toast.error("Image must be under 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const { data } = await api.put("/users/profile", { avatar: base64 });
        dispatch(updateUser({ avatar: data.avatar }));
        toast.success("Avatar updated");
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update avatar");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/users/profile", { username, email });
      dispatch(updateUser({ username: data.username, email: data.email }));
      toast.success("Profile updated");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setEditing(false);
  };

  const displayName = user?.username || "";
  const displayEmail = user?.email || "";
  const avatar = user?.avatar || profileData?.avatar || "";
  const memberSince = profileData?.createdAt;

  const statItems = [
    { label: "Anime", value: stats.anime, icon: HiOutlineSparkles, color: "var(--accent)" },
    { label: "Movies", value: stats.movie, icon: HiOutlineFilm, color: "var(--info)" },
    { label: "TV Shows", value: stats.tv, icon: HiOutlineVideoCamera, color: "var(--success)" },
  ];

  return (
    <div style={{ maxWidth: "600px" }}>
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      {/* Avatar + Info */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "1.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              onClick={handleAvatarClick}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                objectFit: "cover",
                cursor: "pointer",
                border: "2px solid var(--border)",
                transition: "border-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.target.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          ) : (
            <div
              onClick={handleAvatarClick}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), #ff6b8a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div
            onClick={handleAvatarClick}
            style={{
              position: "absolute",
              bottom: "0",
              right: "0",
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "var(--bg-card)",
              border: "2px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "border-color var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <HiOutlineCamera size={12} style={{ color: "var(--text-secondary)" }} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.15rem" }}>
            {displayName}
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
            {displayEmail}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            <HiOutlineClock size={12} />
            <span>Member since {formatMemberSince(memberSince)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        {statItems.map((item) => (
          <div
            key={item.label}
            className="card"
            style={{
              padding: "1.25rem",
              textAlign: "center",
            }}
          >
            <item.icon
              size={20}
              style={{ color: item.color, marginBottom: "0.5rem", opacity: 0.8 }}
            />
            <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>
              {item.value}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.35rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Profile */}
      <div className="card" style={{ padding: "1.75rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: editing ? "1.25rem" : 0,
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Edit Profile</h3>
          {!editing ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.9rem" }}
              onClick={() => setEditing(true)}
            >
              <HiOutlinePencil size={14} />
              Edit
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ padding: "0.45rem" }}
              onClick={handleCancel}
            >
              <HiOutlineX size={16} />
            </button>
          )}
        </div>

        {editing && (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ flex: 1 }}
              >
                <HiOutlineCheck size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500, marginBottom: "0.3rem" }}>
                Username
              </div>
              <div style={{ fontSize: "0.9rem" }}>{displayName}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500, marginBottom: "0.3rem" }}>
                Email
              </div>
              <div style={{ fontSize: "0.9rem" }}>{displayEmail}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
