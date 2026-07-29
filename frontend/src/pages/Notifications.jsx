import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
} from "../features/notificationSlice.js";
import { HiOutlineBell } from "react-icons/hi";
import UpdateContent, { UpdateTypeBadge, PriorityBadge, ReadMoreLink } from "../components/UpdateContent.jsx";

const NotificationSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="skeleton-card" style={{ display: "flex", gap: "1rem" }}>
        <div className="skeleton skeleton-image-sm" style={{ width: "50px", height: "75px" }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text-sm" />
        </div>
      </div>
    ))}
  </div>
);

const Notifications = () => {
  const dispatch = useDispatch();
  const { items, unreadCount, loading, pagination } = useSelector(
    (state) => state.notifications
  );

  useEffect(() => {
    dispatch(fetchNotifications({ page: 1 }));
  }, [dispatch]);

  const handleLoadMore = () => {
    if (pagination?.hasMore) {
      dispatch(fetchNotifications({ page: pagination.page + 1 }));
    }
  };

  if (loading && items.length === 0) {
    return (
      <div>
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>Updates</h1>
            <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
          </div>
        </div>
        <NotificationSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>Updates</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {unreadCount} unread{" "}
            {unreadCount === 1 ? "update" : "updates"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => dispatch(markAllAsRead())}
          >
            Mark all as read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card empty-state">
          <HiOutlineBell size={48} className="empty-state-icon" />
          <h3>No updates yet</h3>
          <p>You'll see activity about your followed titles here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((notification) => (
            <div
              key={notification._id}
              className={`card card-hover`}
              style={{
                opacity: notification.read ? 0.55 : 1,
                borderLeft: notification.read
                  ? "3px solid transparent"
                  : "3px solid var(--accent)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
              onClick={() => {
                if (!notification.read) {
                  dispatch(markAsRead(notification._id));
                }
              }}
            >
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                {notification.title?.poster && (
                  <img
                    src={notification.title.poster}
                    alt={notification.title.title}
                    style={{
                      width: "44px",
                      height: "66px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {notification.title?.title}
                    </h3>
                    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0 }}>
                      {notification.update?.type && <UpdateTypeBadge type={notification.update.type} />}
                      {notification.priority && <PriorityBadge priority={notification.priority} />}
                    </div>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    {notification.message}
                  </p>
                  <UpdateContent update={notification.update} />
                  <ReadMoreLink rawData={notification.update?.rawData} />
                  <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginTop: "0.35rem", opacity: 0.7 }}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {pagination?.hasMore && (
            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
