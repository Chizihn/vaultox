import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rawApiKey = request.headers["x-admin-key"] as
      | string
      | string[]
      | undefined;
    const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
    const normalizedApiKey = apiKey?.trim().replace(/^['\"]|['\"]$/g, "");
    const expected = process.env.ADMIN_API_KEY?.trim();

    if (!expected) {
      throw new ForbiddenException("ADMIN_API_KEY_NOT_CONFIGURED");
    }

    if (!normalizedApiKey || normalizedApiKey !== expected) {
      throw new ForbiddenException("INVALID_ADMIN_API_KEY");
    }

    return true;
  }
}
