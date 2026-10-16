import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Bot, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useAuth } from "../../app/providers/AuthProvider";
import { ApiClientError } from "../../shared/api/apiClient";
import { Button } from "../../shared/components/ui/Button";

const demoAccounts = [
  { label: "Customer demo", email: "customer01@novastore.demo" },
  { label: "Support demo", email: "support@novastore.demo" },
  { label: "Admin demo", email: "admin@novastore.demo" },
];

const highlights = [
  { icon: Bot, text: "Multi-agent routing with cited, policy-grounded answers" },
  { icon: ShieldCheck, text: "Every refund, return and cancellation needs explicit confirmation" },
  { icon: Zap, text: "Seamless handoff to human agents in real time" },
];

const controlClass =
  "mt-2 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

export const LoginPage = (): React.ReactElement => {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("customer01@novastore.demo");
  const [password, setPassword] = useState("demo-password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to={location.state?.from ?? "/support"} replace />;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="animate-float pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-indigo-600/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="animate-float pointer-events-none absolute -bottom-32 -left-16 size-96 [animation-delay:-6s] rounded-full bg-violet-600/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SupportPilot AI</span>
        </div>
        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Customer support that resolves, not just replies.
          </h2>
          <p className="mt-4 text-slate-300">
            An agentic assistant for NovaStore that reads orders and policy, and hands the decisions
            that matter to people.
          </p>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li className="flex items-start gap-3 text-sm text-slate-200" key={text}>
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">NovaStore is a fictional retailer.</p>
      </section>
      <section className="flex items-center justify-center bg-background px-4 py-10">
        <form
          className="animate-rise w-full max-w-md space-y-5 rounded-2xl border border-border bg-surface p-8 shadow-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await login(email, password);
              navigate("/support", { replace: true });
            } catch (loginError) {
              setError(
                loginError instanceof ApiClientError ? loginError.message : "Unable to sign in.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              NovaStore support
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to SupportPilot</h1>
            <p className="mt-2 text-sm text-muted">
              Use a seeded demo account to explore the support workspace.
            </p>
          </div>
          <label className="block text-sm font-medium">
            Email
            <input
              className={controlClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className={controlClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button className="w-full py-2.5" type="submit" busy={busy}>
            Sign in
          </Button>
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted">Quick fill a demo account</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/40 hover:bg-accentSoft hover:text-accent"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword("demo-password");
                  }}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Password for all demo accounts: demo-password</p>
          </div>
        </form>
      </section>
    </main>
  );
};
