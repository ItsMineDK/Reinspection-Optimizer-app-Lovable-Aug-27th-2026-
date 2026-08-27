declare module "leaflet-polylineoffset";

import "leaflet";

declare module "leaflet" {
  interface PolylineOptions {
    offset?: number;
  }
}