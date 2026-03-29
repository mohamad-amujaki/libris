import "./env.js";
import { prisma } from "@libris/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  getPrimaryWebOrigin,
  getTrustedWebOrigins,
} from "./lib/trusted-origins.js";

const baseURL = process.env.BETTER_AUTH_URL ?? getPrimaryWebOrigin();
const secret = process.env.BETTER_AUTH_SECRET ?? "libris-dev-secret-change-me";

export const auth = betterAuth({
  secret,
  baseURL,
  trustedOrigins: getTrustedWebOrigins(),
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
