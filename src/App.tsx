import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import Layout from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index"; // keep eager — it's the LCP page

// Lazy-load secondary routes so their bundles + images don't ship with the homepage
const Services = lazy(() => import("./pages/Services"));
const Materials = lazy(() => import("./pages/Materials"));
const Projects = lazy(() => import("./pages/Projects"));
const Contact = lazy(() => import("./pages/Contact"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SignIn = lazy(() => import("./pages/SignIn"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminNewTicket = lazy(() => import("./pages/admin/AdminNewTicket"));
const AdminTicketDetail = lazy(() => import("./pages/admin/AdminTicketDetail"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Marketing site — no live data; avoid needless refetches that cause re-renders.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="route-fallback" aria-label="Loading page">
    <div className="route-fallback-line" />
    <div className="route-fallback-block" />
    <div className="route-fallback-block" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/services" element={<Services />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
              </Route>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminTickets />} />
                <Route path="new" element={<AdminNewTicket />} />
                <Route path="ticket/:id" element={<AdminTicketDetail />} />
                <Route path="ticket/:id/edit" element={<AdminNewTicket />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
