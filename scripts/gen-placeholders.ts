// יוצר placeholder SVG לכל מפלגה: עיגול בצבע המפלגה עם אות הפתק. הרצה: npx tsx scripts/gen-placeholders.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { PARTIES } from "../lib/parties";

mkdirSync("public/caricatures", { recursive: true });
for (const p of PARTIES) {
  const size = p.letters.length <= 1 ? 190 : p.letters.length === 2 ? 150 : 120;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <circle cx="200" cy="200" r="180" fill="${p.color}" stroke="#111" stroke-width="10"/>
  <text x="200" y="200" text-anchor="middle" dominant-baseline="central" direction="rtl"
    font-family="'Secular One','Assistant',Arial,sans-serif" font-weight="700" font-size="${size}" fill="#fff">${p.letters}</text>
</svg>
`;
  writeFileSync(`public/caricatures/${p.key}.svg`, svg);
}
console.log(`wrote ${PARTIES.length} placeholders`);
