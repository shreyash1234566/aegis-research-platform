import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  documents,
  documentSummaries,
  retrievalResults,
  synthesisQueries,
  synthesisReports,
  claims,
  contradictions,
  entities,
  entityRelationships,
  performanceMetrics,
  InsertDocument,
  InsertDocumentSummary,
  InsertRetrievalResult,
  InsertSynthesisQuery,
  InsertSynthesisReport,
  InsertClaim,
  InsertContradiction,
  InsertEntity,
  InsertEntityRelationship,
  InsertPerformanceMetric,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Document queries
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(doc);
  return result;
}

export async function getDocumentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(documents).where(eq(documents.userId, userId));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDocumentStatus(id: number, status: string, error?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { status, processedAt: new Date() };
  if (error) updateData.processingError = error;
  await db.update(documents).set(updateData).where(eq(documents.id, id));
}

// Document summary queries
export async function createDocumentSummary(summary: InsertDocumentSummary) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(documentSummaries).values(summary);
}

export async function getDocumentSummary(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(documentSummaries).where(eq(documentSummaries.documentId, documentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Synthesis query helpers
export async function createSynthesisQuery(query: InsertSynthesisQuery) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(synthesisQueries).values(query);
  return result;
}

export async function getSynthesisQuery(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(synthesisQueries).where(eq(synthesisQueries.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSynthesisQueryStatus(id: number, status: "pending" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(synthesisQueries).set({ status }).where(eq(synthesisQueries.id, id));
}

// Synthesis report helpers
export async function createSynthesisReport(report: InsertSynthesisReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(synthesisReports).values(report);
}

export async function getSynthesisReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(synthesisReports).where(eq(synthesisReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Claim helpers
export async function createClaim(claim: InsertClaim) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(claims).values(claim);
}

export async function getClaimsByReportId(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(claims).where(eq(claims.reportId, reportId));
}

// Contradiction helpers
export async function createContradiction(contradiction: InsertContradiction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(contradictions).values(contradiction);
}

export async function getContradictionsByReportId(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(contradictions).where(eq(contradictions.reportId, reportId));
}

// Entity helpers
export async function createEntity(entity: InsertEntity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(entities).values(entity);
}

export async function getEntityByName(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(entities).where(eq(entities.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Entity relationship helpers
export async function createEntityRelationship(relationship: InsertEntityRelationship) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(entityRelationships).values(relationship);
}

export async function getEntityRelationships(entity1Id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(entityRelationships).where(eq(entityRelationships.entity1Id, entity1Id));
}

// Performance metrics helpers
export async function createPerformanceMetric(metric: InsertPerformanceMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(performanceMetrics).values(metric);
}

export async function getPerformanceMetrics(metricType: string, limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(performanceMetrics).where(eq(performanceMetrics.metricType, metricType)).limit(limit);
}
