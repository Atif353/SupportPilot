import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">
        {notFound ? "Page not found" : "This page could not be loaded"}
      </h1>
      <p className="text-sm text-muted">
        {notFound
          ? "The address may have changed."
          : "Reload this page to see the current status of your request."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Reload
        </Button>
        <Link className="text-sm text-accent" to="/">
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
