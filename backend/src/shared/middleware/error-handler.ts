import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo debe contener JSON válido.' } });
    return;
  }
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo supera el tamaño permitido.' } });
    return;
  }
  console.error('Error no controlado:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
};
