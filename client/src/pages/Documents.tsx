import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

async function fileToBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      if (!base64) {
        reject(new Error("Failed to encode file"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export default function Documents() {
  const [uploading, setUploading] = useState(false);
  const [selectedSummaryDocumentId, setSelectedSummaryDocumentId] = useState<number | null>(null);

  // Fetch documents
  const {
    data: documents,
    isLoading,
    refetch,
  } = trpc.documents.list.useQuery(undefined, {
    refetchInterval: 2500,
  });

  const summaryQuery = trpc.documents.getSummary.useQuery(
    { documentId: selectedSummaryDocumentId ?? 0 },
    {
      enabled: selectedSummaryDocumentId !== null,
      retry: false,
    }
  );

  // Upload mutation
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded and queued for processing");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload document");
      console.error(error);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const base64Content = await fileToBase64(file);
      await uploadMutation.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        base64Content,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const selectedSummary = summaryQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Research Documents</h1>
          <p className="text-muted-foreground">
            Upload and manage your research documents for synthesis and analysis
          </p>
        </div>

        {/* Upload Section */}
        <Card className="p-8 mb-8 border-2 border-dashed">
          <div className="flex flex-col items-center justify-center">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Upload Documents</h2>
            <p className="text-muted-foreground text-center mb-6">
              Drag and drop or click to upload research documents (PDF, TXT, DOCX)
            </p>
            <label>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".pdf,.txt,.docx,.md"
              />
              <Button
                disabled={uploading}
                className="cursor-pointer"
                asChild
              >
                <span>
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
        </Card>

        {/* Documents List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Documents</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <FileText className="w-8 h-8 text-blue-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">{doc.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {doc.fileName} • {(doc.fileSize! / 1024).toFixed(2)} KB
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.status === "completed" && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Processing complete
                          </p>
                        )}
                        {doc.status === "processing" && (
                          <p className="text-xs text-yellow-600 mt-1">
                            ⟳ Processing...
                          </p>
                        )}
                        {doc.status === "failed" && (
                          <p className="text-xs text-red-600 mt-1">
                            ✗ Processing failed
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSummaryDocumentId(doc.id)}
                      disabled={doc.status !== "completed"}
                    >
                      View Summary
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload your first document to get started
              </p>
            </Card>
          )}
        </div>

        {selectedSummaryDocumentId !== null && (
          <Card className="p-6 mt-8">
            <h2 className="text-xl font-semibold mb-3">
              Document Summary: #{selectedSummaryDocumentId}
            </h2>

            {summaryQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading summary...
              </div>
            ) : summaryQuery.error ? (
              <p className="text-sm text-red-600">{summaryQuery.error.message}</p>
            ) : selectedSummary ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <Streamdown>{selectedSummary.summary || "No summary available."}</Streamdown>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Key Claims</h3>
                  <pre className="text-xs bg-muted rounded p-3 overflow-auto">
                    {JSON.stringify(selectedSummary.keyClaims, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary found for this document yet.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
