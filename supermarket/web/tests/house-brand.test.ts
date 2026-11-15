import { describe, expect, it } from "vitest";
import { houseBrand } from "../lib/house-brand";

describe("מותג הבית", () => {
  it("מזהה לפי השם או היצרן", () => {
    expect(houseBrand("ביצים אומגה L שופרסל 6יח")).toBe("שופרסל");
    expect(houseBrand("קוטג 5%", "רמי לוי שיווק השקמה")).toBe("רמי לוי");
    expect(houseBrand("קוטג 5% 250ג טרה", "---")).toBeNull();
  });
});
