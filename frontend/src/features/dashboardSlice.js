import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api.js";

export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  async ({ page = 1, limit = 50 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/dashboard", {
        params: { page, limit },
      });
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch dashboard"
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    updates: [],
    relatedTitles: [],
    loading: false,
    error: null,
    pagination: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        let newUpdates;
        if (payload.pagination?.page > 1) {
          newUpdates = [...state.updates, ...payload.updates];
        } else {
          newUpdates = payload.updates;
        }
        const seen = new Set();
        state.updates = newUpdates.filter((u) => {
          const titleId = u.title?._id || u.title;
          const key = `${titleId}:${u.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        state.relatedTitles = payload.relatedTitles || [];
        state.pagination = payload.pagination || null;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
