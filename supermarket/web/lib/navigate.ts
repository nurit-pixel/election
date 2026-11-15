/** קישורי ניווט לסניף. לסניף שמוקם רק לפי העיר מנווטים לפי הכתובת הכתובה ולא לפי הנקודה. */
export function navigationLinks(store: {
  lat: number | null;
  lng: number | null;
  approximate: boolean;
  chainName: string;
  address: string | null;
  city: string | null;
}): { waze: string; google: string } | null {
  const text = [store.address, store.city].filter(Boolean).join(", ");
  if (store.lat != null && store.lng != null && !store.approximate) {
    const ll = `${store.lat.toFixed(6)},${store.lng.toFixed(6)}`;
    return {
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    };
  }
  if (!text) return null;
  const query = encodeURIComponent(`${store.chainName} ${text}`);
  return {
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  };
}
