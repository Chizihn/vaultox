import axios from "axios";

interface ErrorPayload {
  message?: string;
  error?: string;
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (isErrorPayload(payload) && typeof payload.message === "string") {
      return payload.message;
    }

    if (isErrorPayload(payload) && typeof payload.error === "string") {
      return payload.error;
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}
