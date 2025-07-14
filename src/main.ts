import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import * as os from "os";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  const port = 8080; // Default to 8080 for Cloud Run compatibility
  const host = "0.0.0.0"; // Listen on all interfaces for Cloud Run

  if (process.env.NODE_ENV === "production") {
    console.log("Running in production mode");
  } else {
    console.log("Running in development mode");
  }

  await app.listen(port);

  // Show detailed server information
  console.log(`🚀 Application is running on:`);
  console.log(`- Local:   http://localhost:${port}`);
  console.log(`- Network: http://${host}:${port}`);
  console.log(`- Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `- Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );

  // Show network interfaces
  const networkInterfaces = os.networkInterfaces();
  console.log(`- Available on network interfaces:`);
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName]?.forEach((networkInterface) => {
      if (networkInterface.family === "IPv4" && !networkInterface.internal) {
        console.log(
          `  * ${interfaceName}: http://${networkInterface.address}:${port}`
        );
      }
    });
  });
}

void bootstrap();
