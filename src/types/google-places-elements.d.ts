import type { DetailedHTMLProps, HTMLAttributes } from "react";

type GmpElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "gmp-place-details-compact": GmpElementProps & { orientation?: "vertical" | "horizontal" };
      "gmp-place-details-place-request": GmpElementProps & { place?: string };
      "gmp-place-content-config": GmpElementProps;
      "gmp-place-address": GmpElementProps;
      "gmp-place-rating": GmpElementProps;
      "gmp-place-type": GmpElementProps;
      "gmp-place-price": GmpElementProps;
      "gmp-place-opening-hours": GmpElementProps;
      "gmp-place-website": GmpElementProps;
      "gmp-place-phone-number": GmpElementProps;
      "gmp-place-summary": GmpElementProps;
      "gmp-place-reviews": GmpElementProps;
      "gmp-place-media": GmpElementProps;
      "gmp-place-attribution": GmpElementProps;
    }
  }
}

export {};
