import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Ruta no encontrada.'));
};
