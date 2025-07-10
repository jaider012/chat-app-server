import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthenticatedRequest): Promise<string> {
    // Use user ID if authenticated, otherwise fall back to IP
    const userId = req.user?.userId;
    if (userId) {
      return userId;
    }
    return req.ip || "unknown";
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Skip throttling for health endpoint
    if (request.url === "/api/health") {
      return true;
    }

    return false;
  }
}
