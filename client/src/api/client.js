import { currentToken } from '../auth/session';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// The API layer has to be able to tear the session down on a 401, but it can't
// import AuthContext (AuthContext -> authApi -> client would be a cycle), and
// it must not reach for `window.location` — a hard navigation throws away React
// state, any in-progress workout, and the page you were trying to reach.
// AuthProvider registers its own handler here instead, so the redirect happens
// inside the router.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * Turn whatever the server sent into one human sentence.
 * ASP.NET hands back three different shapes depending on where the failure
 * came from: a bare string from `Unauthorized("...")`, a string[] from Identity
 * validation, and a ProblemDetails object from model binding. The old client
 * did `res.text()` and rendered all three raw, so a weak password showed the
 * user a literal JSON array.
 */
async function readError(res) {
  const text = await res.text().catch(() => '');
  if (!text) return res.statusText || `Request failed (${res.status})`;

  try {
    const body = JSON.parse(text);
    if (typeof body === 'string') return body;
    if (Array.isArray(body)) return body.join(' ');
    if (body.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors).flat();
      if (messages.length) return messages.join(' ');
    }
    if (body.title) return body.title;
    if (body.message) return body.message;
  } catch {
    // Not JSON — the raw text is the best we have.
  }
  return text;
}

async function request(path, options = {}) {
  const token = currentToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // fetch only rejects on a transport failure, which for a PWA in a gym
    // basement is the common case, not the exotic one.
    throw new ApiError('No connection. Your changes are saved on this device.', 0);
  }

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError('Your session expired. Please sign in again.', 401);
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status);

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
