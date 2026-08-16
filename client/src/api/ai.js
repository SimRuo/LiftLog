import { api } from './client';

export const aiApi = {
  /** Queues a generation. Returns the job to poll — not the plan. */
  startPlan: (description) => api.post('/ai/generate-plan', { description }),
  /** Throws ApiError with status 404 once a job has expired or been lost to a restart. */
  getPlanJob: (id) => api.get(`/ai/generate-plan/${id}`),
};
