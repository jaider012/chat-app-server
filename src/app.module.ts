import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ChatModule } from "./chat/chat.module";
import { CryptoModule } from "./crypto/crypto.module";
import { HealthController } from "./health/health.controller";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "10.65.240.3",
      port: 5432,
      username: "postgres",
      password: ";}%0v&uid9a`^z5x",
      database: "postgres",
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      migrations: [__dirname + "/migrations/*.{ts,js}"],
      synchronize: false,
      migrationsRun: process.env.NODE_ENV !== "production",
      logging: process.env.NODE_ENV === "development",
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    AuthModule,
    UsersModule,
    ChatModule,
    CryptoModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
