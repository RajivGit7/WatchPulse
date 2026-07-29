import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api.js";

export const searchTitles = createAsyncThunk(
  "search/titles",
  async (query, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/search?query=${encodeURIComponent(query)}`);
      return { results: data.results || data, warnings: data.warnings || [] };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Search failed"
      );
    }
  }
);

const searchSlice = createSlice({
  name: "search",
  initialState: {
    results: [],
    warnings: [],
    loading: false,
    error: null,
    searched: false,
  },
  reducers: {
    clearResults: (state) => {
      state.results = [];
      state.warnings = [];
      state.searched = false;
    },
    clearSearchError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchTitles.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.searched = true;
      })
      .addCase(searchTitles.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload.results;
        state.warnings = action.payload.warnings;
      })
      .addCase(searchTitles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearResults, clearSearchError } = searchSlice.actions;
export default searchSlice.reducer;
