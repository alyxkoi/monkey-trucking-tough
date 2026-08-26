import { describe, expect, it } from "vitest";
import { isAuthorizedRole } from "@/lib/admin/adminAccess";

describe("admin authorization roles", () => {
  it.each(["admin", "staff"])("accepts %s", (role) => {
    expect(isAuthorizedRole(role)).toBe(true);
  });

  it.each(["worker", "driver", "authenticated", ""])("rejects %s", (role) => {
    expect(isAuthorizedRole(role)).toBe(false);
  });
});
