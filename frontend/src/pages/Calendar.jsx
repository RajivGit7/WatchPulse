import { useState, useEffect } from "react";
import api from "../services/api.js";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { HiOutlineCalendar } from "react-icons/hi";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const CalendarSkeleton = () => (
  <div className="skeleton-card" style={{ height: "600px" }}>
    <div className="skeleton" style={{ height: "100%", borderRadius: "var(--radius-sm)" }} />
  </div>
);

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const { data } = await api.get("/calendar");
        const formatted = data.map((event) => ({
          id: event.id,
          title: event.title,
          start: new Date(event.date),
          end: new Date(event.date),
          allDay: true,
        }));
        setEvents(formatted);
      } catch (error) {
        console.error("Failed to fetch calendar:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Calendar</h1>
          <p style={{ color: "var(--text-secondary)" }}>Loading calendar...</p>
        </div>
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Upcoming releases for your followed titles
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card empty-state">
          <HiOutlineCalendar size={48} className="empty-state-icon" />
          <h3>No upcoming releases</h3>
          <p>Add titles to your calendar to see their release dates here</p>
        </div>
      ) : (
        <div className="card" style={{ height: "600px", padding: "1rem" }}>
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
          />
        </div>
      )}
    </div>
  );
};

export default Calendar;
