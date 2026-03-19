# Aegis Research Platform - Architecture Documentation

## Overview

Aegis is a sovereign cognitive research platform designed to eliminate hallucinations and synthesize insights from massive documents without losing context. The platform implements a six-layer hallucination defense pipeline and can process documents up to 1M tokens without chunking.

## System Architecture

### Core Components

#### 1. Document Processing Layer
- **Qwen2.5-1M Document Reader**: Processes full documents (up to 1M tokens) without chunking
- **Multimodal Support**: Qwen2.5-VL-32B for images, charts, and scanned documents
- **Audio Processing**: Whisper large-v3 for speech transcription
- **Structured Extraction**: Key claims, entities, dates, contradictions, confidence levels

#### 2. Multi-Source Retrieval System (MEGA-RAG)
- **Module 1 - MSER**: Multi-Source Evidence Retrieval
  - HNSW vector search (dense semantic retrieval)
  - BM25 keyword search (exact term matching)
  - GraphRAG knowledge graph queries
  - Weighted aggregation (40% vector, 35% BM25, 25% GraphRAG)

- **Module 2 - DPAG**: Diverse Candidate Answer Generation
  - Multiple answer generation with different temperatures
  - Cross-encoder reranking for best-supported answers

- **Module 3 - SEAE**: Semantic-Evidential Alignment Evaluation
  - Cosine similarity between answers and evidence
  - BERTScore alignment verification

- **Module 4 - DISC**: Discrepancy-Identified Self-Clarification
  - Contradiction detection between candidates
  - Secondary retrieval for conflicting topics
  - Knowledge-guided conflict resolution

#### 3. Six-Layer Hallucination Defense Pipeline

**Layer 1: MEGA-RAG Multi-Source Retrieval**
- Combines three retrieval methods for comprehensive evidence gathering
- Reduces factual gaps by 40-80% compared to single-source RAG

**Layer 2: CRAG - Retrieval Quality Gating**
- T5-large evaluator scores every retrieved chunk
- Three verdicts: Correct (use), Incorrect (re-retrieve), Ambiguous (clean)
- 19-36% improvement on retrieval quality benchmarks

**Layer 3: Self-RAG - Continuous In-Generation Retrieval**
- Reflection tokens: [Retrieve], [IsREL], [IsSUP], [IsUse]
- Dynamic retrieval during synthesis based on confidence
- 80%+ hallucination reduction on factual precision

**Layer 4: RE-RAG - Document Trust Classifier**
- Confidence scoring for each retrieved document
- Three recommendations: use_rag, use_parametric, explicit_uncertainty
- Prevents confident hallucination from low-trust sources

**Layer 5: Constitutional Verification**
- Grounding check: Match every claim to source chunks
- Contradiction detection: Surface conflicting evidence
- Confidence calibration: High/Medium/Low tiers based on support

**Layer 6: DeepSeek-R1 Reasoning Verification**
- RL-trained self-verification behavior
- Chain-of-thought reasoning for logic validation
- Eliminates logic-based hallucination through trained reasoning

#### 4. Strategic Document Ordering
- Prevents lost-in-the-middle degradation (U-shaped attention curve)
- Positions most relevant documents at start/end (high attention)
- Supporting documents in middle (lower attention acceptable)
- Maximum 5 documents per synthesis context
- Reduces middle-position accuracy gap by ~2%

#### 5. Boss Agent Orchestration
- **DeepSeek-R1 (671B MoE)** or **R1-Distill-32B**: Main orchestration
- Query decomposition into sub-tasks
- Multi-document synthesis coordination
- Final reasoning and verification

#### 6. Knowledge Graph System
- Entity extraction from all documents
- Entity relationship mapping
- Community detection and summarization
- Cross-document entity resolution
- Visual graph exploration interface

### Data Models

#### Core Tables
- **users**: User authentication and roles
- **documents**: Document metadata and S3 references
- **documentSummaries**: Structured extracts from documents
- **synthesisQueries**: Research queries with decomposition
- **synthesisReports**: Final synthesis results with claims
- **claims**: Individual claims with source grounding
- **contradictions**: Detected contradictions between sources
- **entities**: Knowledge graph entities
- **entityRelationships**: Entity relationships in knowledge graph
- **retrievalResults**: MEGA-RAG retrieval results with scoring
- **performanceMetrics**: System performance tracking

### LLM Model Stack

| Role | Model | Context | License | VRAM |
|------|-------|---------|---------|------|
| Boss Agent | DeepSeek-R1-Distill-32B | 128K | Apache 2.0 | ~70GB |
| Document Reader | Qwen2.5-14B-1M | 1M | Apache 2.0 | ~30GB |
| Sub-Agent | DeepSeek-R1-Distill-14B | 128K | Apache 2.0 | ~28GB |
| Synthesis | Self-RAG-13B | 32K | Apache 2.0 | ~26GB |
| Retrieval Gate | T5-large | 8K | Apache 2.0 | ~2GB |
| Multimodal | Qwen2.5-VL-32B | 32K | Apache 2.0 | ~65GB |
| Transcription | Whisper large-v3 | Audio | MIT | ~6GB |
| Embeddings | mE5-large-instruct | 512 | Apache 2.0 | ~1.5GB |

### API Endpoints

#### Document Management
- `POST /api/trpc/documents.getUploadUrl`: Get S3 upload URL
- `GET /api/trpc/documents.list`: List user's documents
- `GET /api/trpc/documents.get`: Get document details
- `GET /api/trpc/documents.getSummary`: Get document summary
- `POST /api/trpc/documents.markProcessed`: Mark as processed
- `PATCH /api/trpc/documents.update`: Update metadata
- `DELETE /api/trpc/documents.delete`: Delete document

#### Synthesis & Queries
- `POST /api/trpc/synthesis.submitQuery`: Submit research query
- `GET /api/trpc/synthesis.getQuery`: Get query status
- `GET /api/trpc/synthesis.listQueries`: List user's queries
- `GET /api/trpc/synthesis.getReport`: Get synthesis report
- `POST /api/trpc/synthesis.createReport`: Create report (internal)
- `GET /api/trpc/synthesis.getDocumentSummaries`: Get summaries for context

## Processing Pipeline

### Document Upload Flow
1. User uploads document via UI
2. Document stored in S3 with metadata in database
3. Status set to "uploading"
4. Backend triggers document processing

### Document Processing Flow
1. Qwen2.5-1M reads full document (up to 1M tokens)
2. Extract key claims, entities, dates, contradictions
3. Generate structured summary
4. Store summary in database
5. Update document status to "completed"
6. Enrich knowledge graph with entities

### Research Query Flow
1. User submits query with optional document selection
2. Query stored in database with status "pending"
3. Boss Agent decomposes query into sub-tasks
4. MEGA-RAG retrieves evidence from three sources
5. CRAG gates retrieval quality
6. Strategic ordering arranges top 5 documents
7. Self-RAG synthesis generates report with reflection
8. Constitutional verification grounds all claims
9. DeepSeek-R1 performs final reasoning
10. Report stored with claims, contradictions, confidence scores
11. Query status updated to "completed"

## Security & Privacy

- All data stored in encrypted S3 buckets
- Database connections use SSL/TLS
- User authentication via Manus OAuth
- Role-based access control (admin/user)
- Document access scoped to document owner
- Query results scoped to query submitter
- No external APIs access sensitive data
- Optional: Deploy in AMD SEV-SNP enclave for hardware-guaranteed privacy

## Performance Optimizations

### Lost-in-the-Middle Mitigation
- Ms-PoE (Modified Position Embedding) applied at inference time
- Strategic document ordering places critical docs at edges
- Maximum 5-document context limit
- Reduces middle-position accuracy gap by ~2%

### Retrieval Optimization
- HNSW index for sub-millisecond vector search
- BM25 index for fast keyword matching
- GraphRAG community summaries for global context
- Parallel retrieval from all three sources

### Synthesis Optimization
- Self-RAG reflection tokens for dynamic retrieval
- Caching of document summaries
- Batch processing of multiple queries
- Incremental knowledge graph updates

## Monitoring & Analytics

### Metrics Tracked
- Hallucination rate per report
- Retrieval quality scores
- Document processing time
- Synthesis time
- Claim verification success rate
- Contradiction detection rate
- Model inference latency
- System resource utilization

### Admin Dashboard
- Real-time performance metrics
- Hallucination rate trends
- Document corpus statistics
- User activity logs
- System health monitoring
- Performance alerts

## Future Enhancements

### Phase 2 (Months 4-6)
- Full Qwen2.5-14B-1M deployment
- Complete MEGA-RAG four-module implementation
- RE-RAG Document Trust Classifier
- Advanced knowledge graph visualization

### Phase 3 (Months 7-9)
- Qwen3-235B-2507 evaluation (if reasoning quality matches R1)
- Qwen2.5-VL-32B multimodal integration
- Advanced contradiction resolution UI
- Custom fine-tuning for domain-specific tasks

### Phase 4+
- Multi-language support (119 languages via Qwen3)
- Real-time collaboration features
- Advanced analytics and insights
- Integration with external data sources
- Custom model fine-tuning capabilities

## References

- Lost in the Middle (Liu et al., TACL 2024)
- Found in the Middle: Ms-PoE (NeurIPS 2024)
- MEGA-RAG (PMC Frontiers 2025)
- CRAG (January 2024)
- Self-RAG (ICLR 2024)
- Qwen2.5-1M Technical Report (Alibaba, January 2025)
- Qwen3 Technical Report (2025)
- DeepSeek-R1 Paper (January 2025)
- Context Rot Study (Chroma 2025)
