import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/primitives";
import { EmptyState } from "../components/ui/states";

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="OpenCube Intel" title="Page not found" />
      <EmptyState
        title="There is nothing at this address"
        description="The link may be stale, or the record it pointed to was never persisted."
        action={
          <Link
            to="/"
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Back to overview
          </Link>
        }
      />
    </>
  );
}
