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

import { addressQueries, shortPlaceName } from "../lib/address";

describe("שאילתות איתור לכתובת", () => {
  it("כתובת מלאה, ואז בלי מספר הבית, ואז העיר", () => {
    expect(addressQueries("דבורה הנביאה 22, תל אביב")).toEqual([
      { query: "דבורה הנביאה 22, תל אביב", level: "exact" },
      { query: "דבורה הנביאה , תל אביב", level: "street" },
      { query: "תל אביב", level: "city" },
    ]);
  });
  it("בלי פסיק אין ניחוש של העיר", () => {
    expect(addressQueries("האדמה 7 חדרה").map((q) => q.level)).toEqual(["exact", "street"]);
    expect(addressQueries("האדמה 7 חדרה")[1].query).toBe("האדמה חדרה");
  });
  it("מספר בית עם אות", () => {
    expect(addressQueries("הרצל 12א, חיפה")[1].query).toBe("הרצל , חיפה");
  });
  it("שם יישוב בלבד: שאילתה אחת", () => {
    expect(addressQueries("חדרה")).toEqual([{ query: "חדרה", level: "exact" }]);
  });
});

describe("שם קצר של המקום שזוהה", () => {
  it("בלי מדינה, מחוז ומיקוד", () => {
    expect(shortPlaceName("22, דבורה הנביאה, נאות אפקה א, תל אביב-יפו, נפת תל אביב, מחוז תל אביב, 6935037, ישראל")).toBe(
      "22, דבורה הנביאה, נאות אפקה א, תל אביב-יפו",
    );
  });
});

import { houseNumberMatched } from "../lib/address";

describe("מספר הבית במקום שזוהה", () => {
  it("המספר מופיע בתוצאה", () => {
    expect(houseNumberMatched("דבורה הנביאה 22, תל אביב", "22, דבורה הנביאה, תל־אביב–יפו")).toBe(true);
    expect(houseNumberMatched("הרצל 12א, חיפה", "12א, הרצל, חיפה")).toBe(true);
  });
  it("נמצא רק הרחוב: מיקום משוער", () => {
    expect(houseNumberMatched("דיזנגוף 99999, תל אביב", "דיזנגוף, תל־אביב–יפו")).toBe(false);
    expect(houseNumberMatched("דיזנגוף 2, תל אביב", "22, דיזנגוף, תל־אביב–יפו")).toBe(false);
  });
  it("כתובת בלי מספר", () => {
    expect(houseNumberMatched("חדרה", "חדרה, נפת חדרה")).toBe(true);
  });
});
