import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    requestId: "test-request-id",
  };
}

describe("system router", () => {
  it("returns health payload without requiring input", async () => {
    const caller = appRouter.createCaller(createContext(null));

    const result = await caller.system.health();

    expect(result.ok).toBe(true);
    expect(typeof result.serverTime).toBe("number");
    expect(typeof result.uptimeSec).toBe("number");
    expect(typeof result.jobs.total).toBe("number");
  });

  it("rejects runtime diagnostics for non-admin users", async () => {
    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "user-open-id",
        name: "User",
        email: "user@example.com",
        loginMethod: "email",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      })
    );

    await expect(caller.system.runtime()).rejects.toBeInstanceOf(TRPCError);
  });
});
