/**
 * White navigation rail + top bar, following the approved reference.
 *
 * The rail is white, not dark: the reference puts the official logo on it, and
 * that asset carries a baked-in near-white background. Dark is spent instead on
 * a single headline panel per screen, where it actually creates hierarchy.
 */

import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useI18n, type Language } from "../i18n";
import { cx } from "../lib/cx";

export function AppShell({ children }: { children: ReactNode }) {
  // The rail is permanent from `lg` up; below that it is a drawer, closed by
  // navigating rather than by an effect watching the location.
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const nav = [
    { to: "/", label: t.nav.overview, end: true, icon: IconGrid },
    { to: "/tasks", label: t.nav.tasks, icon: IconRuns },
    { to: "/team", label: t.nav.team, icon: IconTeam },
    { to: "/matches", label: t.nav.matches, icon: IconTarget },
    { to: "/businesses", label: t.nav.businesses, icon: IconBuilding },
    { to: "/catalog", label: t.nav.catalog, icon: IconBook },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t.nav.skipToContent}
      </a>

      {open ? (
        <button
          type="button"
          aria-label={t.nav.close}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
        />
      ) : null}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-hairline bg-surface transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5">
          <BrandLogo className="w-[168px]" />
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label={t.nav.primary}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
                    />
                  ) : null}
                  <item.icon
                    className={cx(
                      "size-[18px] shrink-0 transition-colors",
                      isActive ? "text-brand-500" : "text-ink-muted group-hover:text-ink-soft",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-semibold text-brand-700"
              >
                MS
              </span>
              <div className="min-w-0">
                <p className="eyebrow">{t.nav.workspace}</p>
                <p className="truncate text-sm font-medium text-ink">Med Spa</p>
                <p className="truncate text-xs text-ink-muted">Miami-Dade County, FL</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-5 sm:px-8">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={t.nav.open}
              className="-ml-1 rounded-lg p-2 text-ink-soft transition hover:bg-canvas-alt lg:hidden"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                <path
                  d="M3 5.5h14M3 10h14M3 14.5h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <Breadcrumbs />

            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft md:inline-flex">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-green-600" />
                {t.nav.evidenceBadge}
              </span>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The official OpenCube logo.
 *
 * Rendered from the real asset, unmodified -- the empty canvas around the
 * artwork is cropped by CSS (see `.brand-logo` in index.css), never by editing
 * the file. Nothing here redraws or approximates the mark.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cx("brand-logo", className)}>
      <img src="/brand/opencube-logo.png" alt={t.brand.logoAlt} />
    </span>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  const options: { value: Language; label: string; short: string }[] = [
    { value: "en", label: t.nav.languageEnglish, short: "EN" },
    { value: "es", label: t.nav.languageSpanish, short: "ES" },
  ];

  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className="inline-flex rounded-full border border-hairline bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.value}
            aria-pressed={active}
            title={option.label}
            onClick={() => setLanguage(option.value)}
            className={cx(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active ? "bg-brand-500 text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const parts = pathname.split("/").filter(Boolean);

  const labels: Record<string, string> = {
    tasks: t.nav.tasks,
    new: t.tasks.newTask,
    team: t.nav.team,
    matches: t.nav.matches,
    businesses: t.nav.businesses,
    catalog: t.nav.catalog,
  };

  if (parts.length === 0) {
    return <p className="text-sm font-medium text-ink">{t.nav.overview}</p>;
  }

  return (
    <nav aria-label={t.nav.breadcrumb} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <NavLink to="/" className="text-ink-muted transition hover:text-ink">
            {t.nav.overview}
          </NavLink>
        </li>
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          const href = "/" + parts.slice(0, index + 1).join("/");
          const label = labels[part] ?? part;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="text-ink-muted">
                /
              </span>
              {last ? (
                <span className="truncate font-medium text-ink" title={label}>
                  {label}
                </span>
              ) : (
                <NavLink
                  to={href}
                  className="truncate text-ink-muted transition hover:text-ink"
                >
                  {label}
                </NavLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type IconProps = { className?: string };

function IconGrid({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M3.5 3.5h5.2v5.2H3.5zM11.3 3.5h5.2v5.2h-5.2zM3.5 11.3h5.2v5.2H3.5zM11.3 11.3h5.2v5.2h-5.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRuns({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M3 6h14M3 10h9M3 14h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="15.5" cy="13.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTarget({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBuilding({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M4 17V4.5A1.5 1.5 0 0 1 5.5 3h5A1.5 1.5 0 0 1 12 4.5V17M12 8.5h3.2A1.3 1.3 0 0 1 16.5 9.8V17M2.6 17h14.8M6.8 6.6h2.4M6.8 9.8h2.4M6.8 13h2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTeam({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <circle cx="7.2" cy="7" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="8.2" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.6 16.4a4.6 4.6 0 0 1 9.2 0M12.9 16.4a3.6 3.6 0 0 1 4.5-3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M4 4.2c2.4-.9 4.4-.6 6 .9 1.6-1.5 3.6-1.8 6-.9v11c-2.4-.9-4.4-.6-6 .9-1.6-1.5-3.6-1.8-6-.9zM10 5.1v11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
