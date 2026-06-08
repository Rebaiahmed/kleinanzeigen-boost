import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

/**
 * Gates admin endpoints behind a static secret. The caller must send
 * `X-Admin-Key: <ADMIN_API_KEY>`. Separate from user JWT auth — this is an
 * operator key, not a user identity.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-admin-key'];
    const expected = process.env.ADMIN_API_KEY;

    if (!expected) {
      throw new ForbiddenException('Admin API is not configured (ADMIN_API_KEY unset).');
    }
    if (!provided || provided !== expected) {
      throw new ForbiddenException('Invalid or missing admin key.');
    }
    return true;
  }
}
