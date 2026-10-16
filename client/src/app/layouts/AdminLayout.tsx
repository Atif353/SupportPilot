import {
  BarChart3,
  Bot,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  FileText,
  LineChart,
  ListTodo,
  LogOut,
  ShieldCheck,
  Users,
  RotateCcw,
} from "lucide-react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "../../shared/components/layout/PageTransition";
import { useAuth } from "../providers/AuthProvider";
import { cn } from "../../shared/utils/cn";
import { initials } from "../../shared/utils/time";
import { BrandMark } from "./CustomerLayout";

const adminGroups = [
  {
    heading: "Workspace",
    links: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/conversations", label: "Conversations", icon: Inbox },
      { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
      { to: "/admin/returns", label: "Returns", icon: RotateCcw },
      { to: "/admin/tickets", label: "Tickets", icon: ListTodo },
    ],
  },
  {
    heading: "Data",
    links: [
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/orders", label: "Orders", icon: ShieldCheck },
      { to: "/admin/knowledge", label: "Knowledge", icon: FileText },
    ],
  },
  {
    heading: "AI quality",
    links: [
      { to: "/admin/ai-runs", label: "AI Runs", icon: Bot },
      { to: "/admin/evaluations", label: "Evaluations", icon: BarChart3 },
      { to: "/admin/analytics", label: "Analytics", icon: LineChart },
    ],
  },
];
const adminLinks = adminGroups.flatMap((group) => group.links);

export const AdminLayout = (): React.ReactElement => {
  const { session, logout } = useAuth();
  const location = useLocation();
  if (!session || !["ADMIN", "SUPPORT"].includes(session.user.role))
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  const { firstName, lastName, role } = session.user;
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink text-slate-300 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight text-white">SupportPilot AI</span>
        </div>
        <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto p-3" aria-label="Admin">
          {adminGroups.map((group) => (
            <div key={group.heading}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === "/admin"}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/5 hover:text-white",
                          isActive && "bg-white/10 text-white shadow-inner",
                        )
                      }
                    >
                      <Icon className="size-4 opacity-80 group-hover:opacity-100" />
                      {link.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-200">
              {initials(firstName, lastName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {firstName} {lastName}
              </p>
              <p className="text-xs text-slate-400">{role}</p>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              onClick={logout}
              className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-surface/80 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Support workspace</p>
              <p className="text-xs text-muted">
                {firstName} {lastName} | {role}
              </p>
            </div>
          </div>
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={logout}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-mutedSurface hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <nav
          aria-label="Admin mobile"
          className="scroll-thin flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 lg:hidden"
        >
          {adminLinks.map((link) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted",
                  isActive && "bg-accentSoft text-accent",
                )
              }
              end={link.to === "/admin"}
              key={link.to}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
};
