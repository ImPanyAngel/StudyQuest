/** A run's character: what it looks like and wears. */

/** One worn item: its colour (palette name or variant), and a second colour for items with two channels. */
export interface Worn {
  item: string;
  color?: string;
  color2?: string;
}

/** Everything drawn: skin tone, head, face, eye colour, and one item per slot (hair, beard, clothes, hat…). */
export interface Look {
  skin: string;
  head: string;
  face: string;
  eyes?: string;
  worn: Record<string, Worn>;
}
