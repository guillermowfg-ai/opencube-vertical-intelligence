import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BusinessesPage } from "./pages/BusinessesPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CommandCenterPage } from "./pages/CommandCenterPage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { MatchesPage } from "./pages/MatchesPage";
import { NewTaskPage } from "./pages/NewTaskPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { TeamPage } from "./pages/TeamPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<CommandCenterPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/new" element={<NewTaskPage />} />
        <Route path="/tasks/:runId" element={<TaskDetailPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:matchId" element={<MatchDetailPage />} />
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        {/* The results workspace used to live under /runs. Old links keep
            working rather than 404-ing after the rename to tasks. */}
        <Route path="/runs" element={<Navigate to="/tasks" replace />} />
        <Route path="/runs/:runId" element={<LegacyRunRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

function LegacyRunRedirect() {
  const runId = window.location.pathname.split("/").filter(Boolean)[1] ?? "";
  const search = window.location.search;
  return <Navigate to={`/tasks/${encodeURIComponent(runId)}${search}`} replace />;
}
