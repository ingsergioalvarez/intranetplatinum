import type { AuthUser, ValidatedRequestData } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      validated?: ValidatedRequestData;
    }
  }
}

export {};
