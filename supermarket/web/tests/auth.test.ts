import { beforeEach, describe, expect, it } from "vitest";
import { familyPassword, sessionToken, verifySession } from "../lib/auth";

describe("סשן חתום", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.FAMILY_PASSWORD;
  });

  it("עוגייה תקינה מחזירה את מזהה המשתמש", async () => {
    expect(await verifySession(await sessionToken(42))).toBe(42);
  });
  it("שינוי המזהה או החתימה פוסל את העוגייה", async () => {
    const token = await sessionToken(42);
    const [, expires, signature] = token.split(".");
    expect(await verifySession(`43.${expires}.${signature}`)).toBeNull();
    expect(await verifySession(`42.${expires}.${"0".repeat(signature.length)}`)).toBeNull();
    expect(await verifySession("42")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
  it("עוגייה שפג תוקפה נפסלת", async () => {
    const old = await sessionToken(42, Date.now() - 181 * 24 * 60 * 60 * 1000);
    expect(await verifySession(old)).toBeNull();
  });
  it("מפתח חתימה אחר פוסל את העוגייה", async () => {
    const token = await sessionToken(42);
    process.env.SESSION_SECRET = "another-secret";
    expect(await verifySession(token)).toBeNull();
  });
  it("בלי מפתח חתימה אין כניסה", async () => {
    const token = await sessionToken(42);
    delete process.env.SESSION_SECRET;
    expect(await verifySession(token)).toBeNull();
  });
  it("הסיסמה המשפחתית פעילה רק כל עוד Google לא הוגדר", () => {
    process.env.FAMILY_PASSWORD = "mishpacha";
    expect(familyPassword()).toBe("mishpacha");
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(familyPassword()).toBe("");
  });
});
