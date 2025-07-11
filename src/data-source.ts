import { DataSource } from "typeorm";
import { config } from "dotenv";

config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "chat_app",
  entities: [__dirname + "/**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*.{ts,js}"],
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  ssl: true,
  extra: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
});
