import { describe, it, expect } from "@jest/globals";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";

describe("auth routes", () => {
  it("expose handlers", async () => {
    expect(typeof login).toBe("function");
    expect(typeof logout).toBe("function");
    expect(typeof me).toBe("function");
  });
});
