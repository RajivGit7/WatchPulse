import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchWatchlist,
  updateWatchlistStatus,
  removeFromWatchlist,
  addToWatchlist,
} from "../features/watchlistSlice.js";
import { searchTitles, clearResults } from "../features/searchSlice.js";
import api from "../services/api.js";
import toast from "react-hot-toast";
import { HiOutlineCollection, HiOutlineSearch } from "react-icons/hi";

const STATUS_OPTIONS = ["watching", "completed", "planned", "dropped"];

const STATUS_COLORS = {
  watching: "var(--success)",
  completed: "var(--info)",
  planned: "var(--warning)",
  dropped: "var(--text-secondary)",
};

const WatchlistSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="skeleton-card" style={{ display: "flex", gap: "1rem" }}>
        <div className="skeleton skeleton-image-sm" style={{ width: "80px", height: "120px" }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: "30%" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <div className="skeleton" style={{ width: "100px", height: "32px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ width: "70px", height: "32px", borderRadius: "6px" }} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SearchSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="skeleton-card" style={{ display: "flex", gap: "1rem" }}>
        <div className="skeleton skeleton-image-sm" />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: "30%" }} />
          <div className="skeleton skeleton-text" />
        </div>
      </div>
    ))}
  </div>
);

const Watchlist = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.watchlist);
  const { results, warnings, loading: searchLoading, searched } = useSelector((state) => state.search);

  useEffect(() => {
    dispatch(fetchWatchlist());
  }, [dispatch]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      dispatch(searchTitles(searchQuery.trim()));
      setShowSearch(true);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSearch(false);
    dispatch(clearResults());
  };

  const isInWatchlist = (externalId) => {
    return items.some((item) => item.title?.externalId === externalId);
  };

  const handleAddFromSearch = async (result) => {
    try {
      const { data } = await api.post("/titles", result);
      const titleId = data._id;
      const linkedTitles = data.linkedTitles || [];

      const addResult = await dispatch(addToWatchlist({ titleId, status: "planned" }));
      if (addToWatchlist.fulfilled.match(addResult)) {
        let msg = `Added "${result.title}" to watchlist`;
        if (linkedTitles.length > 0) {
          for (const linkedId of linkedTitles) {
            await dispatch(addToWatchlist({ titleId: linkedId, status: "planned" }));
          }
          msg += ` + ${linkedTitles.length} linked titles`;
        }
        toast.success(msg);
      } else {
        toast.error(addResult.payload);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add title");
    }
  };

  const handleStatusChange = async (id, status) => {
    const result = await dispatch(updateWatchlistStatus({ id, status }));
    if (updateWatchlistStatus.fulfilled.match(result)) {
      toast.success("Status updated");
    }
  };

  const handleRemove = async (id) => {
    const result = await dispatch(removeFromWatchlist(id));
    if (removeFromWatchlist.fulfilled.match(result)) {
      toast.success("Removed from watchlist");
    }
  };

  const groupByFranchise = (list) => {
    const groups = {};
    for (const entry of list) {
      const key = entry.title?.franchise || entry.title?.externalId || entry._id;
      if (!groups[key]) groups[key] = { franchise: entry.title?.franchise, items: [] };
      groups[key].items.push(entry);
    }
    return Object.values(groups);
  };

  const tmdbResults = results.filter((r) => r.source === "tmdb");
  const anilistResults = results.filter((r) => r.source === "anilist");

  const renderSearchCard = (result, index) => (
    <div key={`${result.externalId}-${index}`} className="card card-hover" style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
      {result.poster && (
        <img
          src={result.poster}
          alt={result.title}
          style={{
            width: "80px",
            height: "120px",
            objectFit: "cover",
            borderRadius: "8px",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.1rem", fontWeight: 600 }}>
          {result.title}
        </h3>
        {result.seasonLabel && (
          <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: "0.15rem", fontWeight: 600 }}>
            {result.seasonLabel}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.35rem" }}>
          <span className="badge badge-info" style={{ textTransform: "capitalize" }}>
            {result.type}
          </span>
          {result.rating > 0 && (
            <span className="badge badge-warning">
              {result.rating.toFixed(1)}
            </span>
          )}
          {result.seasonCount > 0 && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              {result.seasonCount} {result.seasonCount === 1 ? "season" : "seasons"}
            </span>
          )}
          {result.episodeCount > 0 && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              {result.episodeCount} eps
            </span>
          )}
        </div>
        {result.releaseStatus && (
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "0.15rem" }}>
            {result.releaseStatus}
          </p>
        )}
        {result.genres && result.genres.length > 0 && (
          <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            {result.genres.slice(0, 3).join(" · ")}
          </p>
        )}
        {result.description && (
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: "0.5rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.5" }}>
            {result.description}
          </p>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%", fontSize: "0.8rem", padding: "0.5rem" }}
          onClick={() => handleAddFromSearch(result)}
          disabled={isInWatchlist(result.externalId)}
        >
          {isInWatchlist(result.externalId) ? "In Watchlist" : "Add to Watchlist"}
        </button>
      </div>
    </div>
  );

  const groups = groupByFranchise(items);

  return (
    <div>
      <div className="page-header">
        <h1>My Watchlist</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {items.length} {items.length === 1 ? "title" : "titles"} followed
        </p>
      </div>

      <form onSubmit={handleSearch} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Search anime, movies, TV series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2.5rem" }}
            />
            <HiOutlineSearch
              size={18}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
                pointerEvents: "none",
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={searchLoading}>
            {searchLoading ? "Searching..." : "Search"}
          </button>
          {showSearch && (
            <button type="button" className="btn btn-secondary" onClick={handleClearSearch}>
              Clear
            </button>
          )}
        </div>
      </form>

      {showSearch && warnings.length > 0 && (
        <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.2)", borderRadius: "var(--radius-sm)" }}>
          {warnings.map((w, i) => (
            <p key={i} style={{ fontSize: "0.8rem", color: "var(--warning)", margin: 0 }}>{w}</p>
          ))}
        </div>
      )}

      {showSearch && searchLoading && <SearchSkeleton />}

      {showSearch && !searchLoading && anilistResults.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Anime</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {anilistResults.map((result, i) => renderSearchCard(result, `anilist-${i}`))}
          </div>
        </div>
      )}

      {showSearch && !searchLoading && tmdbResults.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Movies & TV</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {tmdbResults.map((result, i) => renderSearchCard(result, `tmdb-${i}`))}
          </div>
        </div>
      )}

      {showSearch && !searchLoading && searched && results.length === 0 && (
        <div className="card empty-state" style={{ marginBottom: "2rem" }}>
          <HiOutlineSearch size={48} className="empty-state-icon" />
          <h3>No results found</h3>
          <p>Try a different search term</p>
        </div>
      )}

      {!showSearch && (
        <>
          {loading ? (
            <WatchlistSkeleton />
          ) : items.length === 0 ? (
            <div className="card empty-state">
              <HiOutlineCollection size={48} className="empty-state-icon" />
              <h3>Your watchlist is empty</h3>
              <p>Search above to find titles to follow</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {groups.map((group, gi) => (
                <div key={gi}>
                  {group.franchise && group.items.length > 1 && (
                    <p style={{ fontSize: "0.8rem", color: "var(--accent)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {group.franchise} — {group.items.length} entries
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {group.items.map((entry) => (
                      <div key={entry._id} className="card card-hover" style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        {entry.title?.poster && (
                          <img
                            src={entry.title.poster}
                            alt={entry.title.title}
                            style={{
                              width: "80px",
                              height: "120px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: "0.95rem", marginBottom: "0.2rem", fontWeight: 600 }}>
                            {entry.title?.title}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                            <span className="badge badge-info" style={{ textTransform: "capitalize" }}>
                              {entry.title?.type}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span className={`status-dot status-dot-${entry.status}`} />
                              <span style={{ fontSize: "0.7rem", color: STATUS_COLORS[entry.status], textTransform: "capitalize", fontWeight: 500 }}>
                                {entry.status}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                            <select
                              value={entry.status}
                              onChange={(e) => handleStatusChange(entry._id, e.target.value)}
                              style={{
                                padding: "0.4rem 0.6rem",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                background: "var(--bg-primary)",
                                color: "var(--text-primary)",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: "0.7rem", padding: "0.35rem 0.65rem" }}
                              onClick={() => handleRemove(entry._id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Watchlist;
