// Standardized API response helpers for consistent error handling

import { NextResponse } from 'next/server';
import { logger } from './logger';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiResponse = {
  success<T>(data: T, status = 200) {
    return NextResponse.json(
      { success: true, data },
      { status }
    );
  },

  error(error: unknown, fallbackMessage = 'An unexpected error occurred') {
    // Handle ApiError
    if (error instanceof ApiError) {
      logger.error(`API Error: ${error.message}`, error, {
        statusCode: error.statusCode,
        code: error.code,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        },
        { status: error.statusCode }
      );
    }

    // Handle standard Error
    if (error instanceof Error) {
      logger.error('Unexpected error in API route', error);

      return NextResponse.json(
        {
          success: false,
          error: {
            message: process.env.NODE_ENV === 'production' 
              ? fallbackMessage 
              : error.message,
          },
        },
        { status: 500 }
      );
    }

    // Handle unknown errors
    logger.error('Unknown error type', undefined, { error });

    return NextResponse.json(
      {
        success: false,
        error: { message: fallbackMessage },
      },
      { status: 500 }
    );
  },

  unauthorized(message = 'Unauthorized') {
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 401 }
    );
  },

  forbidden(message = 'Forbidden') {
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 403 }
    );
  },

  notFound(message = 'Resource not found') {
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 404 }
    );
  },

  badRequest(message = 'Bad request') {
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 400 }
    );
  },

  tooManyRequests(message = 'Too many requests') {
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 429 }
    );
  },
};
