import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyticsRouter } from "./routers/analytics";
import { documentsRouter } from "./routers/documents";
import { graphRouter } from "./routers/graph";
import { synthesisRouter } from "./routers/synthesis";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  documents: documentsRouter,
  synthesis: synthesisRouter,
  graph: graphRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
