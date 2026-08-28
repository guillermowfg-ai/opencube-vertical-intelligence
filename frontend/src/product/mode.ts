/**
 * Product Mode.
 *
 * Launching a task is the product's only write, and it is cost-bearing: it
 * enqueues real discovery and real model calls. It is therefore gated behind
 * one explicit switch rather than being implicitly available wherever the app
 * happens to be served.
 *
 * `VITE_EXECUTION_MODE=readonly` turns it off completely -- the button
 * disappears and `api.createTask` refuses -- which is exactly the shape a
 * future public Judge Mode needs, with no other code touched.
 *
 * The production core stays private either way: this only controls whether the
 * browser offers the action, never how the back end authenticates it.
 */

export type ExecutionMode = "product" | "readonly";

export const executionMode: ExecutionMode =
  import.meta.env.VITE_EXECUTION_MODE === "readonly" ? "readonly" : "product";

export const canLaunchTasks = executionMode === "product";

/**
 * Read-only mode still shows the New Task journey. The page itself states
 * plainly that execution is unavailable and `api.createTask` refuses, so the
 * product story stays walkable without a launch ever being possible.
 */
export const isJudgeMode = executionMode === "readonly";
