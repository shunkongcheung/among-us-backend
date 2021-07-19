const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  type: "postgres",
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true,
  logging: false,
  entities: ["build/entities/**/*.js"],
  migrations: ["build/migrations/**/*.js"],
  subscribers: ["build/subscribers/**/*.js"],
  cli: {
    entitiesDir: "build/entities",
    migrationsDir: "build/migrations",
    subscribersDir: "build/subscribers",
  },
};
