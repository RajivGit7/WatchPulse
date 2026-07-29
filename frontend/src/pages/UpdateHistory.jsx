import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api.js";
import UpdateContent, { UpdateTypeBadge, PriorityBadge, ReadMoreLink } from "../components/UpdateContent.jsx";

const HistorySkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="skeleton-card">
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div className="skeleton" style={{ width: "80px", height: "20px", borderRadius: "4px" }} />
          <div className="skeleton" style={{ width: "50px", height: "20px", borderRadius: "4px" }} />
        </div>
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text-sm" />
      </div>
    ))}
  </div>
);

const UpdateHistory = () => {
  const { titleId } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get(`/updates/${titleId}/history`);
        setHistory(data.updates || data);
      } catch (error) {
        console.error("Failed to fetch update history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [titleId]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Update History</h1>
        </div>
        <HistorySkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Update History</h1>
      </div>

      {history.length === 0 ? (
        <div className="card empty-state">
          <h3>No update history yet</h3>
          <p>Updates for this title will appear here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {history.map((update) => (
            <div key={update._id} className="card card-hover">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                  <UpdateTypeBadge type={update.type} />
                  {update.priority && <PriorityBadge priority={update.priority} />}
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                  {new Date(update.detectedAt).toLocaleString()}
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                {update.summary}
              </p>
              <UpdateContent update={update} />
              <ReadMoreLink rawData={update.rawData} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpdateHistory;
