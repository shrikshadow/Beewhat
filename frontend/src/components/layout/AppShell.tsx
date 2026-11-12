import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Compass, Home, LayoutDashboard, LogOut, Menu, MessageCircle, User as UserIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { dashboardPath, useMe } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
      <img src="/favicon.svg" alt="" aria-hidden="true" className="size-8" />
      <span className="font-heading text-lg font-extrabold tracking-tight text-slate-900">BeeWisely</span>
    </Link>
  );
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );

export default function AppShell() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const dash = me && me.role !== "user" ? dashboardPath(me.role) : null;
  const links = [
    { to: "/home", label: "Home", icon: Home, id: "home" },
    { to: "/explore", label: "Explore", icon: Compass, id: "explore" },
    { to: me ? "/profile" : "/login", label: "Profile", icon: UserIcon, id: "profile" },
    ...(me && (me.role === "user" || me.role === "expert") ? [{ to: "/messages", label: "Messages", icon: MessageCircle, id: "messages" }] : []),
    ...(dash ? [{ to: dash, label: "Dashboard", icon: LayoutDashboard, id: "dashboard" }] : []),
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900" data-testid="demo-mode-banner">
        Demo MVP — profiles marked “Demo profile” are sample data. Payments are simulated; no real money moves.
      </div>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.id} to={l.to} className={linkCls} data-testid={`nav-${l.id}-link`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {me ? (
              <>
                <span className="flex items-center gap-2 text-sm text-slate-600" data-testid="nav-user-name">
                  <InitialsAvatar name={me.full_name} size="sm" />
                  <span className="max-w-32 truncate">{me.full_name}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => endSession("/")} data-testid="nav-logout-button">
                  <LogOut className="size-4" /> Log out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="nav-login-link">
                  Log in
                </Link>
                <Link to="/signup" className={buttonVariants({ size: "sm" })} data-testid="nav-signup-link">
                  Sign up
                </Link>
              </>
            )}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" data-testid="nav-mobile-menu-button" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {links.map((l) => (
                  <NavLink key={l.id} to={l.to} onClick={() => setOpen(false)} className={linkCls} data-testid={`mobile-nav-${l.id}-link`}>
                    {l.label}
                  </NavLink>
                ))}
                <NavLink to="/become-expert" onClick={() => setOpen(false)} className={linkCls} data-testid="mobile-nav-become-expert-link">
                  Become an expert
                </NavLink>
                <div className="mt-4 border-t pt-4">
                  {me ? (
                    <Button variant="outline" className="w-full" onClick={() => endSession("/")} data-testid="mobile-nav-logout-button">
                      Log out
                    </Button>
                  ) : (
                    <div className="grid gap-2">
                      <Button variant="outline" onClick={() => { setOpen(false); nav("/login"); }} data-testid="mobile-nav-login-button">Log in</Button>
                      <Button onClick={() => { setOpen(false); nav("/signup"); }} data-testid="mobile-nav-signup-button">Sign up</Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Logo />
          <div className="flex flex-wrap gap-4">
            <Link to="/explore" className="hover:text-slate-900" data-testid="footer-explore-link">Explore experts</Link>
            <Link to="/become-expert" className="hover:text-slate-900" data-testid="footer-become-expert-link">Become an expert</Link>
            <Link to="/signup" className="hover:text-slate-900" data-testid="footer-signup-link">Create account</Link>
          </div>
          <p>Real professionals only. No AI personas. Demo payments.</p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" aria-label="Mobile">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
          {links.map((l) => (
            <NavLink
              key={l.id}
              to={l.to}
              data-testid={`bottom-nav-${l.id}-link`}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors", isActive ? "text-sky-700" : "text-slate-500")
              }
            >
              <l.icon className="size-5" />
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
