/**
 * Curated chart palette for report visualisations.
 *
 * The default category colours stored in the database are soft pastels that
 * wash out and blur together on the dark-mode card surface. For charts we use
 * this hand-tuned palette instead: saturated enough to stay distinct against
 * both the light (`oklch(1 0 0)`) and dark (`oklch(0.205 0 0)`) card
 * backgrounds, while staying in harmony with the mint brand accent.
 */
export const CHART_PALETTE = [
  "#5FBF9A", // mint (brand)
  "#5B9BD5", // blue
  "#F2A65A", // amber
  "#E06C75", // coral
  "#A78BFA", // violet
  "#34D399", // emerald
  "#F6C453", // gold
  "#F472B6", // pink
  "#4FD1C5", // teal
  "#9CCC65", // lime
  "#FB923C", // orange
  "#7DD3FC", // sky
];

/** Pick a stable, evenly-spread colour for the slice at `index`. */
export function chartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
