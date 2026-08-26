import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileCallBar from "./home/MobileCallBar";

const Layout = ({ children }: { children?: ReactNode }) => {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className={`flex-1 ${onHome ? "" : "pt-24"}`}>{children ?? <Outlet />}</main>
      <Footer />
      {onHome && <MobileCallBar />}
    </div>
  );
};

export default Layout;
