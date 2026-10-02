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
