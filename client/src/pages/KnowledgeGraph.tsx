import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Network, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function KnowledgeGraph() {
  const [search, setSearch] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const overviewQuery = trpc.graph.overview.useQuery({
    entityLimit: 180,
    relationshipLimit: 700,
  });

  const searchQuery = trpc.graph.searchEntities.useQuery(
    { query: search, limit: 40 },
    {
      enabled: search.trim().length > 1,
    }
  );

  const entityGraphQuery = trpc.graph.getEntityGraph.useQuery(
    { entityId: selectedEntityId ?? 0 },
    {
      enabled: selectedEntityId !== null,
    }
  );

  const topEntities = useMemo(() => {
    const entities = overviewQuery.data?.entities ?? [];
    return [...entities]
      .sort((a, b) => (b.mentionCount ?? 0) - (a.mentionCount ?? 0))
      .slice(0, 30);
  }, [overviewQuery.data?.entities]);

  const graphPreview = useMemo(() => {
    const data = overviewQuery.data;
    if (!data) {
      return { nodes: [], edges: [] as Array<{ source: number; target: number }> };
    }

    const nodes = data.entities.slice(0, 24).map((entity, index) => {
      const angle = (index / 24) * Math.PI * 2;
      const radius = 170;
      return {
        id: entity.id,
        label: entity.name,
        x: 220 + Math.cos(angle) * radius,
        y: 220 + Math.sin(angle) * radius,
      };
    });

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = data.relationships
      .filter(
        (relationship) =>
          nodeIds.has(relationship.entity1Id) && nodeIds.has(relationship.entity2Id)
      )
      .slice(0, 50)
      .map((relationship) => ({
        source: relationship.entity1Id,
        target: relationship.entity2Id,
      }));

    return { nodes, edges };
  }, [overviewQuery.data]);

  if (overviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (overviewQuery.error || !overviewQuery.data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-6 border-red-200 bg-red-50">
          <h1 className="text-xl font-semibold text-red-700 mb-2">Knowledge graph unavailable</h1>
          <p className="text-sm text-red-600">
            {overviewQuery.error?.message || "Failed to load graph data."}
          </p>
        </Card>
      </div>
    );
  }

  const entities = search.trim().length > 1
    ? (searchQuery.data ?? [])
    : topEntities;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Explore extracted entities and cross-document relationships.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Entities</p>
            <p className="text-3xl font-semibold">{overviewQuery.data.entities.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Relationships</p>
            <p className="text-3xl font-semibold">{overviewQuery.data.relationships.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-2">Connection Density</p>
            <p className="text-3xl font-semibold">
              {overviewQuery.data.entities.length > 0
                ? (
                    overviewQuery.data.relationships.length /
                    overviewQuery.data.entities.length
                  ).toFixed(2)
                : "0.00"}
            </p>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Graph Preview</h2>
          <div className="overflow-auto border rounded-lg bg-muted/30">
            <svg viewBox="0 0 440 440" className="w-full min-h-[360px]">
              {graphPreview.edges.map((edge, index) => {
                const source = graphPreview.nodes.find((node) => node.id === edge.source);
                const target = graphPreview.nodes.find((node) => node.id === edge.target);
                if (!source || !target) {
                  return null;
                }

                return (
                  <line
                    key={`${edge.source}-${edge.target}-${index}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                );
              })}

              {graphPreview.nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={7}
                    fill="hsl(var(--primary))"
                    fillOpacity={selectedEntityId === node.id ? 1 : 0.65}
                  />
                  <text
                    x={node.x + 9}
                    y={node.y + 4}
                    fontSize="10"
                    fill="hsl(var(--foreground))"
                  >
                    {node.label.slice(0, 18)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search entities by name"
              />
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedEntityId === entity.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => setSelectedEntityId(entity.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{entity.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entity.type || "unknown"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      mentions: {entity.mentionCount ?? 0}
                    </p>
                  </div>
                </button>
              ))}

              {entities.length === 0 && (
                <p className="text-sm text-muted-foreground">No entities found.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-4 h-4" />
              <h2 className="text-lg font-semibold">Entity Detail</h2>
            </div>

            {selectedEntityId === null ? (
              <p className="text-sm text-muted-foreground">
                Select an entity to inspect its neighborhood.
              </p>
            ) : entityGraphQuery.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : entityGraphQuery.error || !entityGraphQuery.data ? (
              <p className="text-sm text-red-600">
                {entityGraphQuery.error?.message || "Failed to load entity graph."}
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">{entityGraphQuery.data.entity.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entityGraphQuery.data.entity.type || "unknown"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">Connected Relationships</p>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {entityGraphQuery.data.relationships.map((relationship) => (
                      <div key={relationship.id} className="p-2 bg-muted rounded text-xs">
                        <p>{relationship.relationshipType}</p>
                        <p className="text-muted-foreground">
                          {relationship.entity1Id} → {relationship.entity2Id} • strength {relationship.strength.toFixed(4)}
                        </p>
                      </div>
                    ))}
                    {entityGraphQuery.data.relationships.length === 0 && (
                      <p className="text-xs text-muted-foreground">No relationships available.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
