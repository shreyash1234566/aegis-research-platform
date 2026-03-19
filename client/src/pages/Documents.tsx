import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Documents() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  // Fetch documents
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();

  // Upload mutation
  const uploadMutation = trpc.documents.getUploadUrl.useMutation({
    onSuccess: (data) => {
      toast.success("Document uploaded successfully");
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to upload document");
      console.error(error);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Get upload URL
      const uploadData = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      // In a real implementation, upload to S3 here
      console.log("Upload URL:", uploadData.uploadUrl);

      // Mark as processed
      // await markProcessedMutation.mutateAsync({
      //   documentId: uploadData.documentId,
      //   s3Url: uploadData.uploadUrl,
      // });
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
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
      </div>
    </div>
  );
}
