import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js reloads modules in development; keep one client (and one connection
// pool) alive across reloads so Postgres does not run out of connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. On Railway, add the Postgres database and set DATABASE_URL to ${{Postgres.DATABASE_URL}}.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Connects on first use rather than on import, so a build (or a health check
 * during startup) does not fail merely because the database URL is not present
 * in that environment yet.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const value = Reflect.get(client(), property);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
