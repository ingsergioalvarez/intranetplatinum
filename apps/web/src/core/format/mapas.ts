/** Enlace para abrir coordenadas en Google Maps (app nativa en celular). */
export const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
