import { api } from './client';

export const authApi = {
  register: (username, password) => api.post('/auth/register', { username, password }),
  login: (username, password) => api.post('/auth/login', { username, password }),

  /** `{ enabled, clientId, scope }` — the server decides whether to offer the button. */
  googleConfig: () => api.get('/auth/google/config'),

  /**
   * Hand the one-time code to the server, which does the exchange with the
   * client secret and returns our own session token.
   *
   * redirectUri is omitted deliberately: the popup flow's code is bound to the
   * literal value "postmessage", which the server supplies.
   */
  google: (code) => api.post('/auth/google', { code }),

  /** `{ linked, email, canUnlink }` for the already-signed-in user. */
  googleStatus: () => api.get('/auth/google/status'),

  /** Attach a Google account to the current user (does not change the session). */
  googleLink: (code) => api.post('/auth/google/link', { code }),

  googleUnlink: () => api.delete('/auth/google/link'),

  /** `{ hasPassword }` — decides whether the account page offers set vs change. */
  passwordStatus: () => api.get('/auth/password/status'),

  /** currentPassword is ignored server-side when the account has none yet. */
  setPassword: (currentPassword, newPassword) =>
    api.post('/auth/password', { currentPassword, newPassword }),
};
