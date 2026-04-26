import { api } from './client';

export const aiApi = {
  generatePlan: (description) => api.post('/ai/generate-plan', { description }),
  getAdvice: (message, history) => api.post('/ai/advice', { message, history }),
};
