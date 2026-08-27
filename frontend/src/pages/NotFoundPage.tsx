import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { PageHeader } from "../components/ui/primitives";
import { EmptyState } from "../components/ui/states";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader eyebrow={t.notFound.eyebrow} title={t.notFound.title} />
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.body}
        action={
          <Link
            to="/"
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {t.notFound.action}
          </Link>
        }
      />
    </>
  );
}
