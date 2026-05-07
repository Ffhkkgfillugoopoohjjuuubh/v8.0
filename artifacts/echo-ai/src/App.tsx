import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import MainLayout from "@/pages/MainLayout";
import ScannerPage from "@/pages/ScannerPage";
import NotebookPage from "@/pages/NotebookPage";
import SettingsPage from "@/pages/SettingsPage";
import NoteDetailPage from "@/pages/NoteDetailPage";
import QuizPage from "@/pages/QuizPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <MainLayout tab="scanner"><ScannerPage /></MainLayout>} />
      <Route path="/notebook" component={() => <MainLayout tab="notebook"><NotebookPage /></MainLayout>} />
      <Route path="/notebook/:id" component={({ params }) => <NoteDetailPage id={params.id} />} />
      <Route path="/notebook/new" component={() => <NoteDetailPage id="new" />} />
      <Route path="/settings" component={() => <MainLayout tab="settings"><SettingsPage /></MainLayout>} />
      <Route path="/quiz" component={QuizPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
