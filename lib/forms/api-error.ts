import { isAxiosError } from "axios"

export type FormApiErrorKind =
  | "validation"
  | "authentication"
  | "authorization"
  | "conflict"
  | "rate_limit"
  | "network"
  | "server"
  | "unexpected"

export type FormApiError = {
  kind: FormApiErrorKind
  message: string
  status?: number
  retryable: boolean
}

function getResponseMessage(data: unknown) {
  if (!data || typeof data !== "object") return undefined

  const response = data as { error?: unknown; message?: unknown }
  if (typeof response.error === "string" && response.error.trim()) return response.error
  if (typeof response.message === "string" && response.message.trim()) return response.message
  return undefined
}

export function classifyFormApiError(
  error: unknown,
  fallbackMessage: string,
): FormApiError {
  if (!isAxiosError(error)) {
    return {
      kind: "unexpected",
      message: fallbackMessage,
      retryable: false,
    }
  }

  const status = error.response?.status
  const message = getResponseMessage(error.response?.data) || fallbackMessage

  if (!error.response) {
    return {
      kind: "network",
      message,
      retryable: true,
    }
  }

  if (status === 400 || status === 422) {
    return { kind: "validation", message, status, retryable: false }
  }
  if (status === 401) {
    return { kind: "authentication", message, status, retryable: false }
  }
  if (status === 403) {
    return { kind: "authorization", message, status, retryable: false }
  }
  if (status === 409) {
    return { kind: "conflict", message, status, retryable: false }
  }
  if (status === 429) {
    return { kind: "rate_limit", message, status, retryable: true }
  }
  if (status && status >= 500) {
    return { kind: "server", message, status, retryable: true }
  }

  return { kind: "unexpected", message, status, retryable: false }
}
