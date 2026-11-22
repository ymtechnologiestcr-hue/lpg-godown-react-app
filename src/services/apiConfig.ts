// Keep API URL configuration separate from the Axios client so network
// monitoring can probe the server without importing the client (and creating
// an api <-> networkMonitor module cycle).
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:5001/api"
).replace(/\/+$/, "");

export const API_SERVER_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");
