interface ApiErrorShape {
  response?: {
    data?: {
      error?: unknown;
      errorCode?: unknown;
    };
  };
}

const apiErrorData = (error: unknown) => (error as ApiErrorShape | null)?.response?.data;

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = apiErrorData(error)?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  const code = apiErrorData(error)?.errorCode;
  return typeof code === 'string' && code.trim() ? code : null;
}
