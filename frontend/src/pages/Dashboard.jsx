import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDashboard } from "../features/dashboardSlice.js";
import { addToWatchlist } from "../features/watchlistSlice.js";
import { HiOutlineBell } from "react-icons/hi";
import toast from "react-hot-toast";
import UpdateContent, { UpdateTypeBadge, PriorityBadge, ReadMoreLink } from "../components/UpdateContent.jsx";

const getDaysUntil = (date) => {
  const now = new Date();
  const target = new Date(date);
  if (isNaN(target.getTime()) || target.getFullYear() < 1900) return null;
  const diffMs = target - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `in ${diffDays} days`;
};

const formatDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime()) || d.getFullYear() < 1900) return "TBA";
  return d.toLocaleDateString();
};

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
      <div className="skeleton skeleton-image-sm" />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" style={{ width: "40%" }} />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text-sm" />
      </div>
    </div>
  </div>
);

const UpdateCard = ({ update }) => (
  <div className="card card-hover">
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
      {update.title?.poster && (
        <img
          src={update.title.poster}
          alt={update.title.title}
          style={{
            width: "60px",
            height: "90px",
            objectFit: "cover",
            borderRadius: "8px",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.25rem",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{update.title?.title}</h3>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <UpdateTypeBadge type={update.type} />
            {update.priority && <PriorityBadge priority={update.priority} />}
          </div>
        </div>
        <p
          style={{
            fontSize: "0.825rem",
            color: "var(--text-secondary)",
            lineHeight: "1.5",
          }}
        >
          {update.summary}
        </p>
        <UpdateContent update={update} />
        <ReadMoreLink rawData={update.rawData} />
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            {formatDate(update.detectedAt)}
          </p>
          {update.title?.nextEpisodeDate && (
            <p style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>
              {getDaysUntil(update.title.nextEpisodeDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const dispatch = useDispatch();
  const { updates, relatedTitles, loading, pagination } = useSelector(
    (state) => state.dashboard
  );
  const { items: watchlist } = useSelector((state) => state.watchlist);

  useEffect(() => {
    dispatch(fetchDashboard({ page: 1 }));
  }, [dispatch]);

  const handleLoadMore = () => {
    if (pagination?.hasMore) {
      dispatch(fetchDashboard({ page: pagination.page + 1 }));
    }
  };

  const handleAddRelated = async (title) => {
    try {
      const addResult = await dispatch(
        addToWatchlist({ titleId: title._id, status: "planned" })
      );
      if (addToWatchlist.fulfilled.match(addResult)) {
        toast.success(`Added "${title.title}" to watchlist`);
      } else {
        toast.error(addResult.payload);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add title");
    }
  };

  const isInWatchlist = (titleId) => {
    return watchlist.some(
      (item) => item.title?._id === titleId || item.title === titleId
    );
  };

  if (loading && updates.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            What changed since your last visit
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUpdates = updates.filter((u) => {
    const d = new Date(u.detectedAt);
    return d >= sevenDaysAgo;
  });

  const releasedRecently = recentUpdates.filter(
    (u) =>
      u.type === "episode_released" ||
      u.type === "movie_released" ||
      u.type === "season_released"
  );

  const upcomingReleases = recentUpdates.filter(
    (u) =>
      u.type === "release_date_announced" &&
      u.rawData?.date &&
      new Date(u.rawData.date) > now
  );

  const recentlyAnnounced = recentUpdates.filter(
    (u) =>
      u.type === "season_confirmed" ||
      u.type === "release_date_announced" ||
      u.type === "release_date_changed" ||
      u.type === "release_delayed" ||
      u.type === "streaming_platform_changed" ||
      u.type === "official_poster_released"
  );

  const officialTrailers = recentUpdates.filter(
    (u) =>
      u.type === "official_trailer_released" ||
      u.type === "official_teaser_released"
  );

  const sections = [
    { title: "Released Recently", items: releasedRecently },
    { title: "Upcoming Releases", items: upcomingReleases },
    { title: "Recently Announced", items: recentlyAnnounced },
    { title: "Official Trailers", items: officialTrailers },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          What changed since your last visit
        </p>
      </div>

      {updates.length === 0 ? (
        <div className="card empty-state">
          <HiOutlineBell
            size={48}
            className="empty-state-icon"
          />
          <h3>No updates yet</h3>
          <p>Add titles to your watchlist to see updates here</p>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.title} style={{ marginBottom: "2rem" }}>
            <h2
              style={{
                fontSize: "1rem",
                marginBottom: "0.75rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {section.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {section.items.map((update) => (
                <UpdateCard key={update._id} update={update} />
              ))}
            </div>
          </div>
        ))
      )}

      {pagination?.hasMore && (
        <button
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "1rem" }}
          onClick={handleLoadMore}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more updates"}
        </button>
      )}

      {relatedTitles.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2
            style={{
              fontSize: "1rem",
              marginBottom: "0.75rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            More from your followed franchises
          </h2>
          <div className="grid grid-4">
            {relatedTitles.map((title) => (
              <div key={title._id} className="card card-hover" style={{ padding: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  {title.poster && (
                    <img
                      src={title.poster}
                      alt={title.title}
                      style={{
                        width: "48px",
                        height: "72px",
                        objectFit: "cover",
                        borderRadius: "6px",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: "0.8rem", marginBottom: "0.15rem", fontWeight: 600 }}>
                      {title.title}
                    </h4>
                    {title.seasonLabel && (
                      <p style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>
                        {title.seasonLabel}
                      </p>
                    )}
                    {title.releaseStatus && (
                      <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                        {title.releaseStatus}
                      </p>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{
                        width: "100%",
                        fontSize: "0.7rem",
                        marginTop: "0.5rem",
                        padding: "0.35rem",
                      }}
                      onClick={() => handleAddRelated(title)}
                      disabled={isInWatchlist(title._id)}
                    >
                      {isInWatchlist(title._id) ? "In Watchlist" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
