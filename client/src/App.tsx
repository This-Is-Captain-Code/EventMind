import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import VisionDemo from "@/pages/vision-demo";
import VertexAIPlatform from "@/pages/vertex-ai-platform";
import MobileClient from "@/pages/mobile-client";

function Router() {
  return (
    <Switch>
      <Route path="/" component={VertexAIPlatform} />
      <Route path="/mobile" component={MobileClient} />
      <Route path="/legacy" component={VisionDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
