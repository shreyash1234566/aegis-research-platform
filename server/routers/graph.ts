import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllEntityRelationships,
  getEntities,
  getEntityById,
  getEntityRelationships,
} from "../db";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export const graphRouter = router({
  overview: protectedProcedure
    .input(
      z.object({
        entityLimit: z.number().int().min(1).max(500).optional(),
        relationshipLimit: z.number().int().min(1).max(1500).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const entityLimit = input.entityLimit ?? 150;
        const relationshipLimit = input.relationshipLimit ?? 500;

        const [entities, relationships] = await Promise.all([
          getEntities(entityLimit),
          getAllEntityRelationships(relationshipLimit),
        ]);

        return {
          entities,
          relationships: relationships.map((relationship) => ({
            ...relationship,
            strength: toNumber(relationship.strength),
          })),
        };
      } catch (error) {
        console.error("Failed to load knowledge graph overview:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load knowledge graph overview",
        });
      }
    }),

  searchEntities: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(1),
        limit: z.number().int().min(1).max(200).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const limit = input.limit ?? 50;
        const allEntities = await getEntities(500);
        const normalizedQuery = input.query.toLowerCase();

        return allEntities
          .filter((entity) => entity.name.toLowerCase().includes(normalizedQuery))
          .slice(0, limit);
      } catch (error) {
        console.error("Failed to search entities:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search entities",
        });
      }
    }),

  getEntityGraph: protectedProcedure
    .input(z.object({ entityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const entity = await getEntityById(input.entityId);
        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity not found",
          });
        }

        const outgoing = await getEntityRelationships(input.entityId);
        const relatedIds = new Set<number>();
        for (const relationship of outgoing) {
          relatedIds.add(relationship.entity1Id);
          relatedIds.add(relationship.entity2Id);
        }

        const allEntities = await getEntities(600);
        const neighbors = allEntities.filter((item) => relatedIds.has(item.id));

        return {
          entity,
          neighbors,
          relationships: outgoing.map((relationship) => ({
            ...relationship,
            strength: toNumber(relationship.strength),
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Failed to load entity graph:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load entity graph",
        });
      }
    }),
});
