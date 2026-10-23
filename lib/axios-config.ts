import axios from "axios"

export const SESSION_REVOKED_EVENT = "qs:session-revoked"

// Base URL for the API - update this with your real API endpoint later
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
})  

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      error?.response?.status === 401 &&
      error?.response?.data?.code === "SESSION_REVOKED"
    ) {
      window.dispatchEvent(new Event(SESSION_REVOKED_EVENT))
    }
    return Promise.reject(error)
  },
)

export default apiClient
