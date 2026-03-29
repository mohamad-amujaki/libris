import { createFileRoute } from "@tanstack/react-router";
import { LibraryRootsPage } from "../../pages/LibraryRootsPage.tsx";

export const Route = createFileRoute("/_authenticated/folders")({
  component: LibraryRootsPage,
});
