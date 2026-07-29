import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api.js";

export const fetchWatchlist = createAsyncThunk(
  "watchlist/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/watchlist");
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch watchlist"
      );
    }
  }
);

export const addToWatchlist = createAsyncThunk(
  "watchlist/add",
  async ({ titleId, status }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/watchlist", { titleId, status });
      return data;
    } catch (error) {
      if (error.response?.status === 400) return null;
      return rejectWithValue(
        error.response?.data?.message || "Failed to add to watchlist"
      );
    }
  }
);

export const updateWatchlistStatus = createAsyncThunk(
  "watchlist/updateStatus",
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/watchlist/${id}`, { status });
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update status"
      );
    }
  }
);

export const removeFromWatchlist = createAsyncThunk(
  "watchlist/remove",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/watchlist/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to remove from watchlist"
      );
    }
  }
);

const watchlistSlice = createSlice({
  name: "watchlist",
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearWatchlistError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWatchlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addToWatchlist.fulfilled, (state, action) => {
        if (action.payload) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(updateWatchlistStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item._id === action.payload._id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(removeFromWatchlist.fulfilled, (state, action) => {
        state.items = state.items.filter(
          (item) => item._id !== action.payload
        );
      });
  },
});

export const { clearWatchlistError } = watchlistSlice.actions;
export default watchlistSlice.reducer;
