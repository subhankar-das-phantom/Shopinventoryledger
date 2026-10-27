import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ENV } from '../config/env.js';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    res.status(statusCode).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
    res.status(statusCode).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  // Handle Mongoose CastError (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    res.status(statusCode).json({
      success: false,
      message: `Invalid identifier format for '${err.path}'`
    });
    return;
  }

  // Handle MongoDB Duplicate Key (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    res.status(statusCode).json({
      success: false,
      message: `Duplicate entry: '${field}' with value '${value}' already exists.`
    });
    return;
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log non-operational server errors
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.url}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(ENV.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {})
  });
};
