import { PostgresStateRepository } from "./postgres-repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run Tandem migrations");

const repository = new PostgresStateRepository(databaseUrl);
try {
  await repository.migrate();
  console.log("Tandem PostgreSQL migrations are current.");
} finally {
  await repository.close();
}
