export class NexumError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "NexumError";
  }
}

export class NexumHttpError extends NexumError {
  constructor(
    message: string,
    status: number,
    readonly statusText: string,
    readonly body?: string,
  ) {
    super(message, status);
    this.name = "NexumHttpError";
  }
}

export class NexumConnectionError extends NexumError {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "NexumConnectionError";
  }
}

export class NexumTimeoutError extends NexumError {
  constructor(message: string) {
    super(message, 408);
    this.name = "NexumTimeoutError";
  }
}

/** The server's human-readable message for a failed request, falling back to the HTTP-level one. */
export function describeNexumError(err: NexumHttpError): string {
  try {
    return (JSON.parse(err.body ?? "") as { message?: string }).message ?? err.message;
  } catch {
    return err.message;
  }
}
