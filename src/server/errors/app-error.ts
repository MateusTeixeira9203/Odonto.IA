import { ErrorCode } from './error-codes';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusHint: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode = ErrorCode.UNAUTHENTICATED, message = 'Não autenticado.') {
    super(code, message, 401);
    this.name = 'AuthError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Sem permissão para esta ação.') {
    super(ErrorCode.INSUFFICIENT_PERMISSION, message, 403);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ErrorCode.VALIDATION_ERROR, message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(ErrorCode.NOT_FOUND, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message, 409);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR, message = 'Serviço externo indisponível.') {
    super(code, message, 502);
    this.name = 'ExternalServiceError';
  }
}
