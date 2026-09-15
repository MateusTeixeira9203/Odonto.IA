export type SessionHealth = 'healthy' | 'expired' | 'technical_failure';

type AuthCheckError = {
  name?: string;
  status?: number;
  code?: string;
};

export function resolveSessionHealth(input: {
  hasUser: boolean;
  error: AuthCheckError | null;
}): SessionHealth {
  if (input.hasUser) return 'healthy';
  if (!input.error) return 'expired';

  const definitelyInvalid = input.error.name === 'AuthSessionMissingError'
    || input.error.status === 401
    || input.error.status === 403
    || input.error.code === 'session_not_found'
    || input.error.code === 'bad_jwt';
  return definitelyInvalid ? 'expired' : 'technical_failure';
}
