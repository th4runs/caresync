export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg);

export function toId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad('Invalid id');
  return n;
}
