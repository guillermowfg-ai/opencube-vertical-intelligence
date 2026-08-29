import type { TeamMemberKind } from "../product/team";

/** Geometry, not mascots: an open cube for discovery and the model agents, a
 * fixed lattice for the deterministic engine. */
export function MemberGlyph({ kind }: { kind: TeamMemberKind }) {
  if (kind === "engine") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15M8.5 4v16M15.5 4v16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        d="M12 3.4 20 7.7v8.6L12 20.6 4 16.3V7.7zM4 7.7l8 4.3 8-4.3M12 12v8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
