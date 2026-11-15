"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { METER_COLORS } from "@/lib/meter";

export type MapStore = {
  storePk: number;
  lat: number;
  lng: number;
  name: string;
  /** המחיר להשוואה (הסל המשוער לסל חלקי) */
  price: number;
  complete: boolean;
  rank: number;
  /** המקום על מד המחיר, 0–4 */
  /** null: סניף שחסרים בו כמה פריטים (אפור) */
  level: number | null;
  /** מוקם רק לפי העיר */
  approximate: boolean;
};

export type MapAddress = { label: string; lat: number; lng: number; radiusKm: number };

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** מפת הסניפים שבהשוואה: כל סניף בצבע שלו על מד המחיר, עם המקום והמחיר. לחיצה פותחת את פרטי הסניף. */
export function StoresMap({ stores, addresses }: { stores: MapStore[]; addresses: MapAddress[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current) return;
      map = L.map(container.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const address of addresses) {
        L.circle([address.lat, address.lng], {
          radius: address.radiusKm * 1000,
          color: "#2b0735",
          weight: 1.5,
          dashArray: "6 6",
          fillColor: "#14fbe1",
          fillOpacity: 0.06,
        }).addTo(map);
        L.marker([address.lat, address.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="pm-map-home" title="${escape(address.label)}">⌂</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          keyboard: false,
        })
          .bindTooltip(escape(address.label), { direction: "top" })
          .addTo(map);
        bounds.extend([address.lat, address.lng]);
      }

      // הזולים מצוירים אחרונים, כדי שיהיו מעל
      for (const store of [...stores].sort((a, b) => b.rank - a.rank)) {
        const color = store.level == null ? "#d9d2dc" : METER_COLORS[store.level];
        const label = `${store.rank}`;
        const marker = L.marker([store.lat, store.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="pm-map-pin${store.approximate ? " pm-map-pin-approx" : ""}" style="background:${color}">${label}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          title: `${store.rank}. ${store.name}`,
          zIndexOffset: 1000 - store.rank,
        });
        marker.bindPopup(
          `<div dir="rtl" class="pm-map-popup">
             <div class="pm-map-popup-name">${store.rank}. ${escape(store.name)}</div>
             <div><b dir="ltr">₪${store.price.toFixed(2)}</b>${store.complete ? " · סל מלא" : store.level == null ? " · חסרים כמה פריטים" : " · בערך, עם השלמת החסרים"}</div>
             ${store.approximate ? '<div class="pm-map-note">מיקום משוער (לפי העיר)</div>' : ""}
             <a href="/store/${store.storePk}">פירוט הסל בסניף ←</a>
           </div>`,
        );
        marker.addTo(map);
        bounds.extend([store.lat, store.lng]);
      }
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      else map.setView([32.08, 34.78], 12);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [stores, addresses]);

  return (
    <div className="overflow-hidden rounded-pm-lg border border-line shadow-card">
      <div ref={container} className="h-[65vh] min-h-[360px] w-full" role="region" aria-label="מפת הסניפים" />
    </div>
  );
}
