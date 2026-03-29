import { createFileRoute } from "@tanstack/react-router";
import { BookDetailPage } from "../../../pages/BookDetailPage";

export const Route = createFileRoute("/_authenticated/books/$bookId")({
  component: function BookDetailRoute() {
    const { bookId } = Route.useParams();
    return <BookDetailPage bookId={bookId} />;
  },
});
