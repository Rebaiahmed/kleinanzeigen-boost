import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MAX_PHOTOS, MAX_PHOTO_SIZE_MB } from '../constants/upload.constants';

/**
 * Global HTTP exception filter.
 * - Normalises all error responses to a consistent JSON shape.
 * - Logs 5xx errors server-side without leaking raw stack traces to clients.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ein interner Serverfehler ist aufgetreten';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message || message;
    } else if ((exception as any)?.name === 'MulterError') {
      // File-upload errors (e.g. a photo over the size limit) — give a clear,
      // actionable German message instead of a generic 500.
      status = HttpStatus.BAD_REQUEST;
      const code = (exception as any).code;
      if (code === 'LIMIT_FILE_SIZE') {
        message = `Maximale Dateigröße pro Foto: ${MAX_PHOTO_SIZE_MB}MB`;
      } else if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Zu viele Dateien — maximal ${MAX_PHOTOS} Fotos.`;
      } else {
        message = 'Datei-Upload fehlgeschlagen. Bitte überprüfe deine Fotos.';
      }
    } else {
      // Unexpected errors — log the full error server-side only
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
