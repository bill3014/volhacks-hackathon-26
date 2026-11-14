export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (kind) => new HttpError(404, `${kind} not found`);
