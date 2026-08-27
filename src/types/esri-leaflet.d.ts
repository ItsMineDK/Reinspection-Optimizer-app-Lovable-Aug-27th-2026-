declare module "esri-leaflet" {
  import type { Layer } from "leaflet";
  export function dynamicMapLayer(options: {
    url: string;
    opacity?: number;
    useCors?: boolean;
    f?: string;
  }): Layer;
  export function featureLayer(options: Record<string, unknown>): Layer;
  export function tiledMapLayer(options: Record<string, unknown>): Layer;
}