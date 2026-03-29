import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});
