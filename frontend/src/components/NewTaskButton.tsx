/** The product's primary action. Shared by the command centre and Tasks. */

import { Link } from "react-router-dom";

export function NewTaskButton({ label }: { label: string }) {
  return (
    <Link
      to="/tasks/new"
      className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path
          d="M8 3.4v9.2M3.4 8h9.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </Link>
  );
}
