/** מיון תוצאות חיפוש: ההצעה הזולה ביותר למעלה. מוצר בלי מחיר בסביבה יורד לסוף; בשוויון נשמר סדר הרלוונטיות. */
export function cheapestFirst<T extends { prices: { price: number }[] }>(products: T[]): T[] {
  const best = (p: T) => (p.prices.length > 0 ? Math.min(...p.prices.map((x) => Number(x.price))) : Infinity);
  return products
    .map((product, index) => ({ product, index, price: best(product) }))
    .sort((a, b) => a.price - b.price || a.index - b.index)
    .map((entry) => entry.product);
}
