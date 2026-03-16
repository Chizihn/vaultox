import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const WalletAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Assuming JwtStrategy populates req.user.walletAddress
    return request.user?.walletAddress;
  },
);
