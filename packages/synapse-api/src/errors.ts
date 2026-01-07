/**
 * Synapse API Errors
 * Custom error types for the Synapse API client
 */

/**
 * Error thrown when Synapse API requests fail
 */
export class SynapseError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: string
  ) {
    super(message);
    this.name = 'SynapseError';
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SynapseError);
    }
  }

  /**
   * Check if this is a specific HTTP status code error
   */
  isStatus(code: number): boolean {
    return this.statusCode === code;
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }

  /**
   * Check if this is a network/timeout error (no status code)
   */
  isNetworkError(): boolean {
    return this.statusCode === undefined;
  }

  /**
   * Create error from HTTP response
   */
  static fromResponse(status: number, text: string): SynapseError {
    return new SynapseError(`HTTP ${status}: ${text}`, status, text);
  }

  /**
   * Create error from network failure
   */
  static fromNetworkError(cause: Error): SynapseError {
    const error = new SynapseError(`Network error: ${cause.message}`);
    error.cause = cause;
    return error;
  }
}
