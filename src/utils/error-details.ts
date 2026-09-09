import { isAxiosError } from "axios";

const responseErrorMessage = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.error === "string"
    ? record.error
    : typeof record.message === "string"
      ? record.message
      : null;
};

export const getErrorMessage = (
  error: unknown,
  fallback = "Unknown error",
): string => {
  if (isAxiosError(error)) {
    const responseMessage = responseErrorMessage(error.response?.data);
    if (responseMessage) return responseMessage;
    if (error.code === "ECONNABORTED") return "Request timed out.";
    if (error.response) return `Request failed (HTTP ${error.response.status}).`;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
};
