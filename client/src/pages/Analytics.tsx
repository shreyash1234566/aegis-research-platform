import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Analytics() {
  const overviewQuery = trpc.analytics.overview.useQuery();
  const metricsQuery = trpc.analytics.metrics.useQuery({ limit: 120 });

  if (overviewQuery.isLoading || metricsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (overviewQuery.error || metricsQuery.error || !overviewQuery.data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-6 border-red-200 bg-red-50">
          <h1 className="text-xl font-semibold text-red-700 mb-2">Analytics unavailable</h1>
          <p className="text-sm text-red-600">
            {overviewQuery.error?.message || metricsQuery.error?.message || "Failed to load analytics data."}
          </p>
        </Card>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const metrics = metricsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track processing throughput, synthesis quality, and system health.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Documents</p>
            <p className="text-3xl font-semibold">{overview.documents.total}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {overview.documents.completed} completed • {overview.documents.processing} processing • {overview.documents.failed} failed
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Research Queries</p>
            <p className="text-3xl font-semibold">{overview.queries.total}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {overview.queries.completed} completed • {overview.queries.processing} processing • {overview.queries.failed} failed
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Avg Hallucination Score</p>
            <p className="text-3xl font-semibold">
              {overview.reports.averageHallucinationScore.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {overview.reports.total} generated reports
            </p>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Metrics</h2>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No metrics captured yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Metric</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2 pr-4">Query ID</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slice(0, 50).map((metric) => (
                    <tr key={metric.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">{metric.metricType}</td>
                      <td className="py-2 pr-4">{metric.value.toFixed(4)}</td>
                      <td className="py-2 pr-4">{metric.queryId ?? "-"}</td>
                      <td className="py-2">{new Date(metric.createdAt).toLocaleString()}</td>
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
