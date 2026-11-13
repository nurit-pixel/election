import { describe, expect, it } from "vitest";
import { inIsrael, tidyAddress } from "../lib/address";

describe("ניקוי כתובת לאיתור", () => {
  it("מסיר מירכאות, רווחים כפולים ופסיקים בקצוות", () => {
    expect(tidyAddress('  הרב עוזיאל  10 ,  פתח תקווה, ')).toBe("הרב עוזיאל 10 , פתח תקווה");
    expect(tidyAddress(`שד' בן גוריון 5, קרית מוצקין`)).toBe("שד בן גוריון 5, קרית מוצקין");
  });
  it("תוצאה מחוץ לישראל נדחית", () => {
    expect(inIsrael(32.09, 34.88)).toBe(true);
    expect(inIsrael(40.7, -74)).toBe(false);
  });
});
