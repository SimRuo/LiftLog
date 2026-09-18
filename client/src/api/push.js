import { api } from './client';

export const pushApi = {
  /** `{ enabled, publicKey }`. Anonymous — the key isn't a secret. */
  config: () => api.get('/push/config'),

  subscribe: (subscription) => api.post('/push/subscribe', subscription),

  unsubscribe: (endpoint) => api.post('/push/unsubscribe', { endpoint }),

  /** Delivers a real notification now, so the toggle can prove itself. */
  test: () => api.post('/push/test', {}),
};
