import { api } from './client';

export const aiApi = {
  generatePlan: (description) => api.post('/api/ai/generate-plan', { description }),
  getAdvice: (message, history) => api.post('/api/ai/advice', { message, history }),
};
