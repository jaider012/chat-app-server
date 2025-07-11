import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return { 
      status: "OK", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development"
    };
  }

  @Get("ready")
  readiness() {
    // Add any readiness checks here (database, external services, etc.)
    return {
      status: "ready",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("live")
  liveness() {
    // Simple liveness check for Cloud Run
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
    };
  }
}
