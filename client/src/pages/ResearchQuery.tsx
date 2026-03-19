import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function ResearchQuery() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<any>(null);

  // Fetch documents
  const { data: documents } = trpc.documents.list.useQuery();

  // Submit query mutation
  const submitQueryMutation = trpc.synthesis.submitQuery.useMutation({
    onSuccess: (data) => {
      toast.success("Query submitted for synthesis");
      // In a real implementation, poll for results or use WebSocket
      setSynthesisResult({
        status: "processing",
        queryId: data.queryId,
      });
    },
    onError: (error) => {
      toast.error("Failed to submit query");
      console.error(error);
    },
  });

  const handleSubmitQuery = async () => {
    if (!query.trim()) {
      toast.error("Please enter a research query");
      return;
    }

    await submitQueryMutation.mutateAsync({
      query,
      documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
    });
  };

  const toggleDocumentSelection = (docId: number) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Research Query Interface</h1>
          <p className="text-muted-foreground">
            Submit research queries to synthesize insights from your documents
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Query Input */}
          <div className="lg:col-span-2">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Research Query</h2>
              <Textarea
                placeholder="Enter your research question or query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-4 min-h-32"
              />
              <Button
                onClick={handleSubmitQuery}
                disabled={submitQueryMutation.isPending || !query.trim()}
                className="w-full"
              >
                {submitQueryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Submit Query
                  </>
                )}
              </Button>
            </Card>

            {/* Synthesis Result */}
            {synthesisResult && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  {synthesisResult.status === "processing" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      <h3 className="text-lg font-semibold">Processing...</h3>
                    </>
                  ) : synthesisResult.status === "completed" ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-semibold">Synthesis Complete</h3>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <h3 className="text-lg font-semibold">Error</h3>
                    </>
                  )}
                </div>

                {synthesisResult.report && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Synthesis Report</h4>
                      <Streamdown>{synthesisResult.report.reportContent}</Streamdown>
                    </div>

                    {synthesisResult.report.claims && (
                      <div>
                        <h4 className="font-semibold mb-2">Key Claims</h4>
                        <div className="space-y-2">
                          {synthesisResult.report.claims.map(
                            (claim: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 bg-muted rounded-lg text-sm"
                              >
                                <div className="flex items-start gap-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                      claim.confidenceTier === "high"
                                        ? "bg-green-100 text-green-800"
                                        : claim.confidenceTier === "medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {claim.confidenceTier.toUpperCase()}
                                  </span>
                                  <p>{claim.claimText}</p>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {synthesisResult.report.contradictions &&
                      synthesisResult.report.contradictions.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 text-orange-600">
                            ⚠ Contradictions Detected
                          </h4>
                          <div className="space-y-2">
                            {synthesisResult.report.contradictions.map(
                              (contradiction: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm"
                                >
                                  <p className="font-semibold mb-1">
                                    Contradiction ({contradiction.severity})
                                  </p>
                                  <p className="mb-1">
                                    <strong>Claim 1:</strong> {contradiction.claim1}
                                  </p>
                                  <p>
                                    <strong>Claim 2:</strong> {contradiction.claim2}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Document Selection */}
          <div>
            <Card className="p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Select Documents</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose which documents to include in the synthesis (optional)
              </p>

              {documents && documents.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm truncate">{doc.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No documents available. Upload documents first.
                </p>
              )}

              {selectedDocuments.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold">
                    {selectedDocuments.length} document(s) selected
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
