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
const ControlCenterLayout = lazy(() => import("./control-center/ExactControlCenterLayout"));
const Overview = lazy(() => import("./control-center/approved/screens/Overview").then((module) => ({ default: module.Overview })));
const NeedsAttention = lazy(() => import("./control-center/approved/screens/NeedsAttention").then((module) => ({ default: module.NeedsAttention })));
const LeadsQuotes = lazy(() => import("./control-center/approved/screens/LeadsQuotes").then((module) => ({ default: module.LeadsQuotes })));
const Customers = lazy(() => import("./control-center/approved/screens/Customers").then((module) => ({ default: module.Customers })));
const Jobs = lazy(() => import("./control-center/approved/screens/Jobs").then((module) => ({ default: module.Jobs })));
const Tickets = lazy(() => import("./control-center/approved/screens/Tickets").then((module) => ({ default: module.Tickets })));
const Money = lazy(() => import("./control-center/approved/screens/Money").then((module) => ({ default: module.Money })));
const SettingsHome = lazy(() => import("./control-center/approved/screens/SettingsHome").then((module) => ({ default: module.SettingsHome })));
const LeadDetail = lazy(() => import("./control-center/approved/screens/LeadDetail").then((module) => ({ default: module.LeadDetail })));
const QuoteDetail = lazy(() => import("./control-center/approved/screens/QuoteScreen").then((module) => ({ default: module.QuoteScreen })));
const JobDetail = lazy(() => import("./control-center/approved/screens/JobDetail").then((module) => ({ default: module.JobDetail })));
const CustomerDetail = lazy(() => import("./control-center/approved/screens/CustomerDetail").then((module) => ({ default: module.CustomerDetail })));
const InvoiceDetail = lazy(() => import("./control-center/approved/screens/InvoiceDetail").then((module) => ({ default: module.InvoiceDetail })));
const TicketBuilder = lazy(() => import("./control-center/approved/screens/TicketBuilder").then((module) => ({ default: module.TicketBuilder })));
const TicketDetail = lazy(() => import("./control-center/approved/screens/TicketDetail").then((module) => ({ default: module.TicketDetail })));
const SettingsBusiness = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsBusiness })));
const SettingsMaterials = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsMaterials })));
const SettingsWorkers = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsWorkers })));
const SettingsCommunication = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsCommunication })));
const SettingsTracking = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsTracking })));
const SettingsUsers = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsUsers })));
const SettingsPrinting = lazy(() => import("./control-center/approved/screens/settings").then((module) => ({ default: module.SettingsPrinting })));

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
                <Route path="settings/business" element={<SettingsBusiness />} />
                <Route path="settings/materials" element={<SettingsMaterials />} />
                <Route path="settings/workers" element={<SettingsWorkers />} />
                <Route path="settings/communication" element={<SettingsCommunication />} />
                <Route path="settings/tracking" element={<SettingsTracking />} />
                <Route path="settings/users" element={<SettingsUsers />} />
                <Route path="settings/printing" element={<SettingsPrinting />} />

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
