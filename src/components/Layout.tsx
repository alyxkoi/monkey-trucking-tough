import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileCallBar from "./home/MobileCallBar";

const Layout = ({ children }: { children?: ReactNode }) => {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const showMobileActions = ["/", "/services", "/materials", "/projects", "/contact", "/driveways"].includes(pathname);
  const quoteTo = pathname === "/driveways" ? "/driveways#driveway-quote" : "/contact";
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Header />
      <main
        key={pathname}
        className={`public-route-enter flex-1 ${onHome ? "" : "pt-[76px]"}`}
      >
        {children ?? <Outlet />}
      </main>
      <Footer clearMobileActions={showMobileActions} />
      {showMobileActions && <MobileCallBar quoteTo={quoteTo} />}
    </div>
  );
};

export default Layout;
