import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../services/api.js";
import { addToWatchlist } from "../features/watchlistSlice.js";
import toast from "react-hot-toast";

const TitleDetailSkeleton = () => (
  <div>
    <div className="skeleton" style={{ width: "100%", height: "300px", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }} />
    <div style={{ display: "flex", gap: "2rem" }}>
      <div className="skeleton" style={{ width: "200px", height: "300px", borderRadius: "8px", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-title" style={{ width: "60%" }} />
        <div className="skeleton skeleton-text" style={{ width: "30%" }} />
        <div className="skeleton skeleton-text" style={{ width: "20%" }} />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text" style={{ width: "80%" }} />
      </div>
    </div>
  </div>
);

const TitleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [title, setTitle] = useState(null);
  const [loading, setLoading] = useState(true);
  const { items: watchlist } = useSelector((state) => state.watchlist);

  useEffect(() => {
    const fetchTitle = async () => {
      try {
        const { data } = await api.get(`/titles/${id}`);
        setTitle(data);
      } catch (error) {
        toast.error("Failed to load title details");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchTitle();
  }, [id, navigate]);

  const isInWatchlist = watchlist.some(
    (item) => item.title?._id === id
  );

  const handleAdd = async () => {
    const result = await dispatch(addToWatchlist({ titleId: id, status: "planned" }));
    if (addToWatchlist.fulfilled.match(result)) {
      if (title.linkedTitles && title.linkedTitles.length > 0) {
        for (const linked of title.linkedTitles) {
          await dispatch(addToWatchlist({ titleId: linked._id, status: "planned" }));
        }
        toast.success(`Added to watchlist + ${title.linkedTitles.length} linked titles`);
      } else {
        toast.success("Added to watchlist");
      }
    } else {
      toast.error(result.payload);
    }
  };

  if (loading) return <TitleDetailSkeleton />;
  if (!title) return null;

  return (
    <div>
      {title.backdrop && (
        <div style={{ position: "relative", marginBottom: "1.5rem", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <img
            src={title.backdrop}
            alt={title.title}
            style={{
              width: "100%",
              height: "300px",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "60%",
              background: "linear-gradient(transparent, var(--bg-primary))",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {title.poster && (
          <img
            src={title.poster}
            alt={title.title}
            style={{
              width: "180px",
              height: "270px",
              objectFit: "cover",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              flexShrink: 0,
              marginTop: title.backdrop ? "-6rem" : 0,
              position: "relative",
              zIndex: 1,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem", fontWeight: 800 }}>{title.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <span className="badge badge-info" style={{ textTransform: "capitalize" }}>
              {title.type}
            </span>
            <span className="badge badge-success">{title.releaseStatus}</span>
            {title.rating > 0 && (
              <span className="badge badge-warning">{title.rating.toFixed(1)}</span>
            )}
          </div>
          {title.releaseDate && (
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Released: {new Date(title.releaseDate).toLocaleDateString()}
            </p>
          )}
          {title.genres && title.genres.length > 0 && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              {title.genres.join(" · ")}
            </p>
          )}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {title.episodeCount > 0 && (
              <div>
                <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{title.episodeCount}</p>
                <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Episodes</p>
              </div>
            )}
            {title.seasonCount > 0 && (
              <div>
                <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{title.seasonCount}</p>
                <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Seasons</p>
              </div>
            )}
          </div>
          {title.nextEpisodeDate && (
            <p style={{ marginBottom: "0.75rem", color: "var(--accent)", fontWeight: 600, fontSize: "0.9rem" }}>
              Next episode: {new Date(title.nextEpisodeDate).toLocaleDateString()}
            </p>
          )}
          {title.streamingAvailability && (
            <p style={{ fontSize: "0.8rem", color: "var(--teal)", marginBottom: "0.75rem" }}>
              Streaming on: {
                Array.isArray(title.streamingAvailability)
                  ? title.streamingAvailability.join(", ")
                  : typeof title.streamingAvailability === "object"
                    ? Object.values(title.streamingAvailability).flat().join(", ")
                    : String(title.streamingAvailability)
              }
            </p>
          )}
          {title.description && (
            <p style={{ marginBottom: "1.5rem", lineHeight: "1.7", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              {title.description}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {!isInWatchlist && (
              <button className="btn btn-primary" onClick={handleAdd}>
                Add to Watchlist
              </button>
            )}
            {isInWatchlist && (
              <span className="badge badge-success" style={{ fontSize: "0.75rem", padding: "0.5rem 0.75rem" }}>
                In Watchlist
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/updates/${title._id}/history`)}
            >
              View Update History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TitleDetail;
