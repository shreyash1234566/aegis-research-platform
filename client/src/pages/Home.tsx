import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Search, Brain, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-white mb-4">
              Aegis Research Platform
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Eliminate hallucinations and synthesize insights from massive documents
              without losing context. Process up to 1M tokens per document with our
              six-layer hallucination defense pipeline.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="p-6 bg-slate-800 border-slate-700">
                <Brain className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Six-Layer Defense
                </h3>
                <p className="text-sm text-slate-300">
                  MEGA-RAG, CRAG, Self-RAG, RE-RAG, Constitutional Verification,
                  and DeepSeek-R1 reasoning
                </p>
              </Card>

              <Card className="p-6 bg-slate-800 border-slate-700">
                <FileText className="w-8 h-8 text-green-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  1M Token Documents
                </h3>
                <p className="text-sm text-slate-300">
                  Read entire research papers, legal documents, and patent databases
                  without chunking
                </p>
              </Card>

              <Card className="p-6 bg-slate-800 border-slate-700">
                <Search className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Multi-Source Retrieval
                </h3>
                <p className="text-sm text-slate-300">
                  HNSW vector search, BM25 keyword matching, and GraphRAG knowledge
                  graphs
                </p>
              </Card>

              <Card className="p-6 bg-slate-800 border-slate-700">
                <BarChart3 className="w-8 h-8 text-orange-400 mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Claim-Level Grounding
                </h3>
                <p className="text-sm text-slate-300">
                  Every claim traced to source chunks with confidence tiers and
                  contradiction detection
                </p>
              </Card>
            </div>

            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              Sign In to Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {user?.name || "Researcher"}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your sovereign cognitive research platform is ready
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/documents")}>
            <FileText className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="font-semibold mb-2">Upload Documents</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add research papers, PDFs, and documents to your corpus
            </p>
            <Button variant="outline" size="sm">
              Go to Documents
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/research")}>
            <Search className="w-8 h-8 text-green-500 mb-3" />
            <h3 className="font-semibold mb-2">Research Query</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Submit queries to synthesize insights from your documents
            </p>
            <Button variant="outline" size="sm">
              Submit Query
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <BarChart3 className="w-8 h-8 text-purple-500 mb-3" />
            <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Monitor hallucination rates and retrieval quality metrics
            </p>
            <Button variant="outline" size="sm" disabled>
              Coming Soon
            </Button>
          </Card>
        </div>

        {/* Platform Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Platform Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Hallucination Defense</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ MEGA-RAG multi-source retrieval</li>
                <li>✓ CRAG retrieval quality gating</li>
                <li>✓ Self-RAG continuous verification</li>
                <li>✓ Constitutional verification</li>
                <li>✓ DeepSeek-R1 reasoning verification</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Long-Context Processing</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ 1M token document reading</li>
                <li>✓ Strategic document ordering</li>
                <li>✓ Lost-in-the-middle mitigation</li>
                <li>✓ Multimodal document support</li>
                <li>✓ Audio transcription (Whisper)</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Knowledge Graph</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Entity extraction and linking</li>
                <li>✓ Relationship mapping</li>
                <li>✓ Community detection</li>
                <li>✓ Visual graph exploration</li>
                <li>✓ Cross-document entity resolution</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Synthesis & Reporting</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Claim-level source attribution</li>
                <li>✓ Confidence scoring</li>
                <li>✓ Contradiction detection</li>
                <li>✓ Markdown export</li>
                <li>✓ Real-time synthesis tracking</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Getting Started */}
        <Card className="p-8 bg-blue-50 border-blue-200">
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-bold text-blue-600 min-w-8">1.</span>
              <span>Upload your research documents using the Documents section</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600 min-w-8">2.</span>
              <span>
                Submit a research query to synthesize insights across your corpus
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600 min-w-8">3.</span>
              <span>
                Review synthesis reports with claim-level grounding and confidence
                scores
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600 min-w-8">4.</span>
              <span>
                Explore contradictions and refine your understanding with the
                knowledge graph
              </span>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
