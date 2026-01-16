/**
 * Google Search Console specific errors
 */

export class GSCAuthRequiredError extends Error {
  constructor(message: string = 'Google OAuth token is required. Please authenticate with Google Search Console.') {
    super(message)
    this.name = 'GSC_AUTH_REQUIRED'
    Object.setPrototypeOf(this, GSCAuthRequiredError.prototype)
  }
}

export class GSCApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'GSC_API_ERROR'
    Object.setPrototypeOf(this, GSCApiError.prototype)
  }
}

