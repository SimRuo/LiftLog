import { api } from './client';
import { readThrough, cacheKeys } from '../offline/store';

export const progressApi = {
  get: (exerciseId, metric = 'maxWeight') =>
    readThrough(`${cacheKeys.progress(exerciseId)}:${metric}`, () =>
      api.get(`/progress/${exerciseId}?metric=${metric}`),
    ),
};
