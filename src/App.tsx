import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
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
const ControlCenterLayout = lazy(() => import("./control-center/ControlCenterLayout"));
const Overview = lazy(() => import("./control-center/pages").then((module) => ({ default: module.Overview })));
const NeedsAttention = lazy(() => import("./control-center/pages").then((module) => ({ default: module.NeedsAttention })));
const LeadsQuotes = lazy(() => import("./control-center/pages").then((module) => ({ default: module.LeadsQuotes })));
const Customers = lazy(() => import("./control-center/pages").then((module) => ({ default: module.Customers })));
const Jobs = lazy(() => import("./control-center/pages").then((module) => ({ default: module.Jobs })));
const Tickets = lazy(() => import("./control-center/pages").then((module) => ({ default: module.Tickets })));
const Money = lazy(() => import("./control-center/pages").then((module) => ({ default: module.Money })));
const SettingsHome = lazy(() => import("./control-center/pages").then((module) => ({ default: module.SettingsHome })));
const LeadDetail = lazy(() => import("./control-center/details").then((module) => ({ default: module.LeadDetail })));
const QuoteDetail = lazy(() => import("./control-center/details").then((module) => ({ default: module.QuoteDetail })));
const JobDetail = lazy(() => import("./control-center/details").then((module) => ({ default: module.JobDetail })));
const CustomerDetail = lazy(() => import("./control-center/details").then((module) => ({ default: module.CustomerDetail })));
const InvoiceDetail = lazy(() => import("./control-center/details").then((module) => ({ default: module.InvoiceDetail })));
const SettingsSection = lazy(() => import("./control-center/details").then((module) => ({ default: module.SettingsSection })));
const TicketBuilder = lazy(() => import("./control-center/ticketPages").then((module) => ({ default: module.TicketBuilder })));
const TicketDetail = lazy(() => import("./control-center/ticketPages").then((module) => ({ default: module.TicketDetail })));

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
              <Route path="/admin" element={<ControlCenterLayout />}>
                <Route index element={<Overview />} />
                <Route path="attention" element={<NeedsAttention />} />
                <Route path="leads" element={<LeadsQuotes />} />
                <Route path="leads/:leadId" element={<LeadDetail />} />
                <Route path="quotes/:quoteId" element={<QuoteDetail />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="jobs/:jobId" element={<JobDetail />} />
                <Route path="tickets" element={<Tickets />} />
                <Route path="tickets/new" element={<TicketBuilder />} />
                <Route path="tickets/:ticketId" element={<TicketDetail />} />
                <Route path="tickets/:ticketId/edit" element={<TicketBuilder />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customers/:customerId" element={<CustomerDetail />} />
                <Route path="money" element={<Money />} />
                <Route path="money/invoices/:invoiceId" element={<InvoiceDetail />} />
                <Route path="settings" element={<SettingsHome />} />
                <Route path="settings/:section" element={<SettingsSection />} />

                {/* Backward-compatible links from the retired Ticket-only dashboard. */}
                <Route path="new" element={<Navigate to="/admin/tickets/new" replace />} />
                <Route path="ticket/:ticketId" element={<TicketDetail />} />
                <Route path="ticket/:ticketId/edit" element={<TicketBuilder />} />
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
