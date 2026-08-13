"use client";

/**
 * Wraps Google's Place UI Kit <gmp-place-details-compact> web component.
 * Requires the "places" Maps JS library to already be loaded (see
 * googleMapsLoader.ts) and a Google Place ID — it renders nothing useful
 * without one. Per Google's docs, styles must be applied directly on the
 * element (external stylesheets don't reach into its internals), and an
 * explicit width is required for it to render correctly.
 */
export function PlaceDetailsCard({ placeId }: { placeId: string }) {
  return (
    <gmp-place-details-compact
      className="gmp-card-theme"
      style={{ width: "300px", maxWidth: "100%" }}
    >
      <gmp-place-details-place-request place={placeId} />
      <gmp-place-content-config>
        <gmp-place-media lightbox-preferred />
        <gmp-place-rating />
        <gmp-place-type />
        <gmp-place-price />
        <gmp-place-address />
        <gmp-place-attribution light-scheme-color="gray" dark-scheme-color="white" />
      </gmp-place-content-config>
    </gmp-place-details-compact>
  );
}
