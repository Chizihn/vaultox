import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class ActiveCredentialGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // In actual implementation, the JWT payload or a Request override should attach the credentialStatus
    if (!user || !["active", "verified"].includes(user.credentialStatus)) {
      throw new ForbiddenException("CREDENTIAL_NOT_VERIFIED");
    }

    return true;
  }
}
