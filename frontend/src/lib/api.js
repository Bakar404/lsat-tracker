export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const SERVER_DOWN =
  "Could not reach the local parser. Make sure the app server is running (make run), then try again.";

async function errorMessage(response) {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const messages = body.detail.map((item) => item?.msg).filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
  } catch {
    // Not a JSON error body, for example a proxy error page.
  }
  if (response.status >= 500) return SERVER_DOWN;
  return `The server rejected the upload (HTTP ${response.status}).`;
}

/** Sends one PDF to the local backend and returns `{ filename, metadata, rows }`. */
export async function transformReport(file, { signal } = {}) {
  const body = new FormData();
  body.append("file", file, file.name);
  let response;
  try {
    response = await fetch("/api/transform", { method: "POST", body, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(SERVER_DOWN, 0);
  }
  if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
  return response.json();
}
