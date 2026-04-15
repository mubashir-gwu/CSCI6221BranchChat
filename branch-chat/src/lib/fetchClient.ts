export const BACKEND_UNAVAILABLE_CODE = "BACKEND_UNAVAILABLE";

export class BackendUnavailableClientError extends Error {
  constructor(message = "Backend services are unavailable") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

// Wraps fetch and throws BackendUnavailableClientError when the server
// reports a 503 with the BACKEND_UNAVAILABLE code. Other failures are
// returned as a normal Response for the caller to handle.
export async function fetchOrThrowOnBackendDown(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 503) return res;

  const text = await res.text();
  let code: string | undefined;
  try {
    code = JSON.parse(text)?.code;
  } catch {
    // non-JSON 503 — treat as generic
  }
  if (code === BACKEND_UNAVAILABLE_CODE) {
    throw new BackendUnavailableClientError();
  }
  // Reconstruct a Response so callers can still read the body.
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
