import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice.js";
import watchlistReducer from "./watchlistSlice.js";
import dashboardReducer from "./dashboardSlice.js";
import searchReducer from "./searchSlice.js";
import notificationReducer from "./notificationSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    watchlist: watchlistReducer,
    dashboard: dashboardReducer,
    search: searchReducer,
    notifications: notificationReducer,
  },
});
