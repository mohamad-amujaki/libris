import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import { LoginPage } from "../pages/LoginPage";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data?.user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});
