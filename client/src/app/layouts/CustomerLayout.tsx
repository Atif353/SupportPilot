import {
  LogOut,
  MessageSquare,
  Package,
  RotateCcw,
  Sparkles,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "../../shared/components/layout/PageTransition";
import { useAuth } from "../providers/AuthProvider";
import { cn } from "../../shared/utils/cn";
import { initials } from "../../shared/utils/time";

const customerLinks = [
  { to: "/support", label: "Support", icon: MessageSquare },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/returns", label: "Returns", icon: RotateCcw },
  { to: "/refunds", label: "Refunds", icon: Wallet },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/profile", label: "Profile", icon: User },
];

export const BrandMark = ({ className }: { className?: string }): React.ReactElement => (
  <span
    className={cn(
      "grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-pop",
      className,
    )}
  >
    <Sparkles className="size-5" aria-hidden="true" />
  </span>
);

export const CustomerLayout = (): React.ReactElement => {
  const { session, logout } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (session.user.role !== "CUSTOMER") return <Navigate to="/admin" replace />;
  const { firstName, lastName } = session.user;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink to="/support" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight">SupportPilot AI</span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {customerLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-mutedSurface hover:text-foreground",
                      isActive && "bg-accentSoft text-accent hover:bg-accentSoft hover:text-accent",
                    )
                  }
                >
                  <Icon className="size-4" />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-full bg-accentSoft text-xs font-semibold text-accent"
              aria-hidden="true"
            >
              {initials(firstName, lastName)}
            </span>
            <span className="hidden text-sm font-medium lg:inline">
              {firstName} {lastName}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-mutedSurface hover:text-foreground"
              onClick={logout}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
        <nav
          aria-label="Main mobile"
          className="scroll-thin flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
        >
          {customerLinks.map((link) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted",
                  isActive && "bg-accentSoft text-accent",
                )
              }
              key={link.to}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
};
