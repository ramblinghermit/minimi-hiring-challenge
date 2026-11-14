import { Request } from 'express';
import { userStore } from '../core/auth/user-store';
import { SafeUser } from '../core/types';

/**
 * Resolves the authenticated user from the Request via:
 * 1. Bearer Token in `Authorization` header
 * 2. `token` in query parameters (for EventSource SSE streams)
 * 3. Fallback to `user_id` in query/body
 * 4. Default user fallback if none provided
 */
export async function getAuthUser(req: Request): Promise<SafeUser> {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
  }

  if (token) {
    const user = await userStore.verifyToken(token);
    if (user) return user;
  }

  const requestedUserId = (req.query.user_id as string) || (req.body?.user_id as string);
  if (requestedUserId) {
    const user = await userStore.getUserById(requestedUserId);
    if (user) return user;
  }

  // Default fallback user for backwards compatibility and tests
  const defaultUser = await userStore.getUserById('default_user');
  if (defaultUser) return defaultUser;

  return {
    id: 'default_user',
    username: 'default_user',
    name: 'Default User',
    role: 'standard',
    createdAt: new Date().toISOString(),
  };
}
