import type { RequestHandler } from 'express';
import { getHealth } from './health.service.js';

export const healthController: RequestHandler = (_request, response) => {
  response.set('Cache-Control', 'no-store').status(200).json(getHealth());
};
