/**
 * Left rail + top bar.
 *
 * The rail is the one dark surface in the product. It earns that by being the
 * only thing on screen that is not analysis: everything else is a light
 * working surface, so "where am I" and "what am I reading" never compete.
 */

import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cx } from "../lib/cx";

const NAV = [
  { to: "/", label: "Overview", end: true, icon: IconGrid },
  { to: "/runs", label: "Runs", icon: IconRuns },
  { to: "/matches", label: "Opportunities", icon: IconTarget },
  { to: "/businesses", label: "Businesses", icon: IconBuilding },
  { to: "/catalog", label: "Catalog", icon: IconBook },
];

export function AppShell({ children }: { children: ReactNode }) {
  // The rail is permanent from `lg` up; below that it is a drawer, closed by
  // navigating rather than by an effect watching the location.
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-rail transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Brand />
        <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-rail-soft text-white"
                    : "text-slate-400 hover:bg-rail-soft/60 hover:text-slate-100",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cx(
                      "size-[18px] shrink-0 transition-colors",
                      isActive ? "text-brand-500" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive ? (
                    <span aria-hidden="true" className="h-4 w-0.5 rounded-full bg-brand-500" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-rail-line px-5 py-4">
          <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-slate-500 uppercase">
            Active vertical
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-100">Med Spa</p>
          <p className="text-xs text-slate-500">Miami-Dade County, Florida</p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-5 sm:px-8">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label="Open navigation"
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

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft sm:inline-flex">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-600" />
                Evidence-grounded · V1
              </span>
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

function Brand() {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-rail-line px-5">
      <CubeMark />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-white">
          Open<span className="text-brand-500">Cube</span> Intel
        </p>
        <p className="truncate text-[0.6875rem] text-slate-500">Vertical Intelligence</p>
      </div>
    </div>
  );
}

/** An isometric open cube — three faces, one left open, which is as close to
 * the mark as a 24px glyph should try to get. */
function CubeMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="size-7 shrink-0">
      <path d="M14 3.2 24 8.6v10.8L14 24.8 4 19.4V8.6z" fill="#161f33" />
      <path d="M14 3.2 24 8.6 14 14 4 8.6z" fill="#f97316" />
      <path d="M4 8.6 14 14v10.8L4 19.4z" fill="#ea580c" opacity="0.72" />
      <path
        d="M24 8.6 14 14v10.8l10-5.4z"
        fill="none"
        stroke="#f97316"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

const CRUMB_LABELS: Record<string, string> = {
  runs: "Runs",
  matches: "Opportunities",
  businesses: "Businesses",
  catalog: "Catalog",
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return <p className="text-sm font-medium text-ink">Overview</p>;
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <NavLink to="/" className="text-ink-muted transition hover:text-ink">
            Overview
          </NavLink>
        </li>
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          const href = `/${parts.slice(0, index + 1).join("/")}`;
          const label = CRUMB_LABELS[part] ?? part;
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
      <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
