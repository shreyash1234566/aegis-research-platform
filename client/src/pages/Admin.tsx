import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Admin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const queries = trpc.synthesis.listQueries.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const overview = trpc.analytics.overview.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const alerts = trpc.analytics.alerts.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 15000,
  });
  const runtime = trpc.system.runtime.useQuery(undefined, {
    enabled: Boolean(user && user.role === "admin"),
    refetchInterval: 15000,
  });
  const activity = trpc.analytics.activity.useQuery(undefined, {
    enabled: Boolean(user && user.role === "admin"),
    refetchInterval: 15000,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-8 max-w-xl mx-auto text-center border-amber-200 bg-amber-50">
          <Shield className="w-10 h-10 mx-auto text-amber-700 mb-3" />
          <h1 className="text-xl font-semibold text-amber-800 mb-2">Admin access required</h1>
          <p className="text-sm text-amber-700">
            This page is restricted to workspace administrators.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Console</h1>
          <p className="text-muted-foreground">
            Operational view for synthesis throughput and system reliability.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">System Snapshot</h2>
          {overview.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : overview.error || !overview.data ? (
            <p className="text-sm text-red-600">
              {overview.error?.message || "Failed to load system snapshot."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Documents</p>
                <p className="text-xl font-semibold">{overview.data.documents.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Queries</p>
                <p className="text-xl font-semibold">{overview.data.queries.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Hallucination</p>
                <p className="text-xl font-semibold">{overview.data.reports.averageHallucinationScore.toFixed(4)}</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Operational Alerts</h2>
          {alerts.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : alerts.error || !alerts.data ? (
            <p className="text-sm text-red-600">
              {alerts.error?.message || "Failed to load alerts."}
            </p>
          ) : alerts.data.alerts.length === 0 ? (
            <p className="text-sm text-green-700">No active alerts.</p>
          ) : (
            <div className="space-y-3">
              {alerts.data.alerts.map((alert) => (
                <div
                  key={`${alert.code}-${alert.value}`}
                  className={`p-3 rounded border text-sm ${
                    alert.severity === "high"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : alert.severity === "medium"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}
                >
                  <p className="font-semibold">{alert.code}</p>
                  <p>{alert.message}</p>
                  <p className="text-xs mt-1">
                    value {alert.value} • threshold {alert.threshold}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Runtime Jobs</h2>
          {runtime.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : runtime.error || !runtime.data ? (
            <p className="text-sm text-red-600">
              {runtime.error?.message || "Failed to load runtime diagnostics."}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-semibold">{runtime.data.uptimeSec}s</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Jobs Total</p>
                  <p className="font-semibold">{runtime.data.summary.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed Jobs</p>
                  <p className="font-semibold">{runtime.data.summary.byStatus.failed}</p>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-3">Job</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Attempt</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runtime.data.jobs.slice(0, 20).map((job) => (
                      <tr key={job.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{job.name}</td>
                        <td className="py-2 pr-3 capitalize">{job.status}</td>
                        <td className="py-2 pr-3">{job.attempt}</td>
                        <td className="py-2 pr-3">{new Date(job.createdAt).toLocaleTimeString()}</td>
                        <td className="py-2 text-red-600">{job.lastError || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">User Activity Logs</h2>
          {activity.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : activity.error || !activity.data ? (
            <p className="text-sm text-red-600">
              {activity.error?.message || "Failed to load user activity logs."}
            </p>
          ) : activity.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user activity logs yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Metric</th>
                    <th className="py-2 pr-3">Value</th>
                    <th className="py-2 pr-3">Query</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.data.slice(0, 50).map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{item.metricType}</td>
                      <td className="py-2 pr-3">{item.value}</td>
                      <td className="py-2 pr-3">{item.queryId ?? "-"}</td>
                      <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Recent Queries</h2>
          {queries.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : queries.error || !queries.data ? (
            <p className="text-sm text-red-600">
              {queries.error?.message || "Failed to load recent queries."}
            </p>
          ) : queries.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queries submitted yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Query</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.data.slice(0, 50).map((query) => (
                    <tr key={query.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{query.id}</td>
                      <td className="py-2 pr-4 capitalize">{query.status}</td>
                      <td className="py-2 pr-4">{new Date(query.createdAt).toLocaleString()}</td>
                      <td className="py-2">{query.query}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
