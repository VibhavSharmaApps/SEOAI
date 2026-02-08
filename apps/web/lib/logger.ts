// Production-ready logging utility

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private formatMessage(level: LogLevel, message: string, context?: LogContext) {
    if (this.isProduction) {
      return JSON.stringify({
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
      });
    }
    return message;
  }

  debug(message: string, context?: LogContext) {
    if (!this.isProduction) {
      console.debug(this.formatMessage('debug', message, context), context);
    }
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatMessage('info', message, context), context);
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context), context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { error };

    console.error(
      this.formatMessage('error', message, { ...context, ...errorInfo }),
      errorInfo
    );
  }
}

export const logger = new Logger();
