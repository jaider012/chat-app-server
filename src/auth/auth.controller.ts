import { Controller, Get, UseGuards, Req, Res } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("google")
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(AuthGuard("google"))
  googleAuth() {}

  @Get("google/callback")
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(AuthGuard("google"))
  googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const result = this.authService.login(req.user as User);
      
      // Validate redirect URL to prevent open redirect vulnerability
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const allowedDomains = [
        "http://localhost:3000",
        "https://localhost:3000",
        frontendUrl,
      ];
      
      if (!allowedDomains.includes(frontendUrl)) {
        throw new Error("Invalid redirect URL");
      }
      
      const redirectUrl = `${frontendUrl}/auth/callback?token=${result.access_token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Google auth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      
      // Validate error redirect URL as well
      const allowedDomains = [
        "http://localhost:3000",
        "https://localhost:3000",
        frontendUrl,
      ];
      
      if (allowedDomains.includes(frontendUrl)) {
        res.redirect(`${frontendUrl}/auth/error`);
      } else {
        res.status(400).json({ error: "Invalid redirect configuration" });
      }
    }
  }
}
