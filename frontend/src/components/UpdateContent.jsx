const TYPE_LABELS = {
  episode_released: "Episode Released",
  movie_released: "Movie Released",
  season_released: "Season Released",
  season_confirmed: "Season Confirmed",
  release_date_announced: "Release Date Announced",
  release_date_changed: "Release Date Changed",
  release_delayed: "Release Delayed",
  official_trailer_released: "Official Trailer",
  official_teaser_released: "Official Teaser",
  official_poster_released: "Official Poster",
  streaming_platform_changed: "Streaming Changed",
  news_article: "News",
};

const TYPE_COLORS = {
  episode_released: "#4caf50",
  movie_released: "#4caf50",
  season_released: "#4caf50",
  season_confirmed: "#2196f3",
  release_date_announced: "#2196f3",
  release_date_changed: "#ff9800",
  release_delayed: "#f44336",
  official_trailer_released: "#e94560",
  official_teaser_released: "#e94560",
  official_poster_released: "#9c27b0",
  streaming_platform_changed: "#00bcd4",
  news_article: "#9e9e9e",
};

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#f44336" },
  high: { label: "High", color: "#ff9800" },
  medium: { label: "Medium", color: "#2196f3" },
  low: { label: "Low", color: "#9e9e9e" },
};

export const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;

  return (
    <span
      style={{
        fontSize: "0.55rem",
        padding: "0.1rem 0.35rem",
        borderRadius: "3px",
        background: `${config.color}20`,
        color: config.color,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.label}
    </span>
  );
};

export const UpdateTypeBadge = ({ type }) => {
  const label = TYPE_LABELS[type] || type?.replace(/_/g, " ") || "Unknown";
  const color = TYPE_COLORS[type] || "#e94560";

  return (
    <span
      style={{
        fontSize: "0.6rem",
        padding: "0.15rem 0.45rem",
        borderRadius: "4px",
        background: color,
        color: "white",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
};

const UpdateContent = ({ update }) => {
  if (!update) return null;
  const { type, rawData } = update;

  switch (type) {
    case "official_trailer_released":
    case "official_teaser_released":
      return rawData?.videoId ? (
        <a
          href={rawData.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: "0.5rem" }}
        >
          <img
            src={`https://img.youtube.com/vi/${rawData.videoId}/mqdefault.jpg`}
            alt={rawData.title || rawData.trailerTitle || "Trailer"}
            style={{
              width: "100%",
              maxWidth: "320px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              transition: "transform var(--transition-fast)",
            }}
            onMouseOver={(e) => (e.target.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
          />
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--accent)",
              marginTop: "0.35rem",
              fontWeight: 500,
            }}
          >
            Watch on YouTube
          </p>
        </a>
      ) : rawData?.trailerTitle ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            marginTop: "0.25rem",
          }}
        >
          {rawData.trailerTitle}
        </p>
      ) : null;

    case "official_poster_released":
      return rawData?.imageUrl ? (
        <img
          src={rawData.imageUrl}
          alt="Official Poster"
          style={{
            maxWidth: "200px",
            borderRadius: "8px",
            marginTop: "0.5rem",
            border: "1px solid var(--border)",
          }}
        />
      ) : null;

    case "episode_released":
      return rawData ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#4caf50",
            marginTop: "0.25rem",
            fontWeight: 600,
          }}
        >
          Episode {rawData.episode} released
        </p>
      ) : null;

    case "movie_released":
    case "season_released":
      return rawData ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#4caf50",
            marginTop: "0.25rem",
            fontWeight: 600,
          }}
        >
          {type === "movie_released" ? "Movie" : `Season ${rawData.season}`} released
        </p>
      ) : null;

    case "season_confirmed":
      return rawData ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#2196f3",
            marginTop: "0.25rem",
            fontWeight: 600,
          }}
        >
          New season officially confirmed
        </p>
      ) : null;

    case "release_date_announced":
      return rawData?.date ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#2196f3",
            marginTop: "0.25rem",
          }}
        >
          Release date: {new Date(rawData.date).getFullYear() >= 1900 ? new Date(rawData.date).toLocaleDateString() : "TBA"}
        </p>
      ) : null;

    case "release_date_changed":
      return rawData?.new ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#ff9800",
            marginTop: "0.25rem",
          }}
        >
          New date: {new Date(rawData.new).getFullYear() >= 1900 ? new Date(rawData.new).toLocaleDateString() : "TBA"}
        </p>
      ) : null;

    case "release_delayed":
      return rawData ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#f44336",
            marginTop: "0.25rem",
            fontWeight: 600,
          }}
        >
          Delayed by {rawData.delayDays} days — now{" "}
          {new Date(rawData.new).getFullYear() >= 1900 ? new Date(rawData.new).toLocaleDateString() : "TBA"}
        </p>
      ) : null;

    case "streaming_platform_changed":
      return rawData ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            marginTop: "0.25rem",
          }}
        >
          {Array.isArray(rawData.new)
            ? rawData.new.join(", ")
            : "Availability changed"}
        </p>
      ) : null;

    case "news_article":
      return rawData?.newsTitle ? (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            marginTop: "0.25rem",
            fontStyle: "italic",
          }}
        >
          {rawData.newsTitle}
        </p>
      ) : null;

    default:
      return null;
  }
};

export const ReadMoreLink = ({ rawData }) => {
  if (!rawData?.link) return null;
  return (
    <a
      href={rawData.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: "0.75rem",
        color: "var(--accent)",
        marginTop: "0.35rem",
        display: "inline-block",
        fontWeight: 500,
      }}
    >
      Read article &rarr;
    </a>
  );
};

export default UpdateContent;
