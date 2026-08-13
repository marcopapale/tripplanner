"use client";

/**
 * Wraps Google's Place UI Kit <gmp-place-details-compact> web component.
 * Requires the "places" Maps JS library to already be loaded (see
 * googleMapsLoader.ts) and a Google Place ID — it renders nothing useful
 * without one.
 */
export function PlaceDetailsCard({ placeId }: { placeId: string }) {
  return (
    <gmp-place-details-compact orientation="vertical" className="gmp-card-theme">
      <gmp-place-details-place-request place={placeId} />
      <gmp-place-content-config>
        <gmp-place-address />
        <gmp-place-rating />
        <gmp-place-type />
        <gmp-place-price />
        <gmp-place-opening-hours />
        <gmp-place-website />
        <gmp-place-phone-number />
        <gmp-place-summary />
        <gmp-place-media />
        <gmp-place-attribution />
      </gmp-place-content-config>
    </gmp-place-details-compact>
  );
}
