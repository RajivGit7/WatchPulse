import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api.js";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async ({ page = 1, limit = 30 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/notifications", {
        params: { page, limit },
      });
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch notifications"
      );
    }
  }
);

export const markAsRead = createAsyncThunk(
  "notifications/markRead",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/notifications/${id}/read`);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to mark as read"
      );
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await api.patch("/notifications/read-all");
      return true;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to mark all as read"
      );
    }
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [],
    unreadCount: 0,
    loading: false,
    error: null,
    pagination: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (payload.pagination?.page > 1) {
          state.items = [...state.items, ...payload.notifications];
        } else {
          state.items = payload.notifications;
        }
        state.unreadCount = payload.unreadCount;
        state.pagination = payload.pagination || null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item._id === action.payload._id
        );
        if (index !== -1) {
          state.items[index].read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.items.forEach((item) => (item.read = true));
        state.unreadCount = 0;
      });
  },
});

export default notificationSlice.reducer;
