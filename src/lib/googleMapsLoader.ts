"use client";

// Google's official dynamic bootstrap loader (adapted to TS), documented at
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api
// It defines `google.maps.importLibrary` synchronously; the actual <script>
// tag is only injected the first time a library is requested.
function bootstrap(apiKey: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  if ((w.google as { maps?: { importLibrary?: unknown } } | undefined)?.maps?.importLibrary) return;

  ((g: Record<string, unknown>) => {
    let h: Promise<void> | undefined;
    let a: HTMLScriptElement;
    let k: string;
    const p = "The Google Maps JavaScript API";
    const c = "google";
    const l = "importLibrary";
    const q = "__ib__";
    const m = document;
    let b = window as unknown as Record<string, unknown>;
    b = (b[c] as Record<string, unknown>) || (b[c] = {} as Record<string, unknown>);
    (window as unknown as Record<string, unknown>)[c] = b;
    const d = (b.maps as Record<string, unknown>) || (b.maps = {} as Record<string, unknown>);
    const r = new Set<string>();
    const e = new URLSearchParams();
    const u = () =>
      h ||
      (h = new Promise<void>((resolve, reject) => {
        a = m.createElement("script");
        e.set("libraries", [...r].join(","));
        for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), String(g[k]));
        e.set("callback", c + ".maps." + q);
        a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
        (d as Record<string, unknown>)[q] = resolve;
        a.onerror = () => {
          h = undefined as unknown as Promise<void>;
          reject(new Error(p + " could not load."));
        };
        a.nonce = m.querySelector("script[nonce]")?.getAttribute("nonce") || "";
        m.head.append(a);
      }));
    if ((d as Record<string, unknown>)[l]) {
      console.warn(p + " only loads once. Ignoring extra load.");
    } else {
      (d as Record<string, (...args: unknown[]) => unknown>)[l] = (f: unknown, ...n: unknown[]) => {
        r.add(f as string);
        return u().then(() => (d[l] as (...a: unknown[]) => unknown)(f, ...n));
      };
    }
  })({ key: apiKey, v: "weekly" });
}

type GoogleNamespace = typeof google;

export async function loadGoogleMapsLibraries(
  apiKey: string,
  libraries: string[]
): Promise<GoogleNamespace> {
  bootstrap(apiKey);
  const g = (window as unknown as { google: GoogleNamespace }).google;
  await Promise.all(libraries.map((lib) => g.maps.importLibrary(lib)));
  return g;
}
