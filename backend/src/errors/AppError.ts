export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly errorCode = 'INTERNAL_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
