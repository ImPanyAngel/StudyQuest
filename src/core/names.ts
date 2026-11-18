/**
 * Display names for LPC items. The art keeps its original names in the credits; the plugin shows
 * these: glued words split, shorthand spelled out, lone words given their kind, title case.
 */

/** Names that general rules can't fix, by item id. */
const RENAMES: Record<string, string> = {
  "arms/arms_armour": "Arm Armour",
  "arms/shoulders/shoulders_legion": "Legion Pauldrons",
  "arms/shoulders/shoulders_mantal": "Mantle",
  "body/body": "Skin",
  "body/tails/tail_lizard_alt": "Lizard Tail 2",
  "body/wings/wings_lizard_alt": "Lizard Wings 2",
  "feet/feet_armour": "Armoured Boots",
  "feet/boots/feet_boots_revised": "Boots",
  "feet/shoes/feet_shoes_revised": "Shoes",
  "feet/shoes/feet_shoes_sara": "Flat Shoes",
  "hair/bald/hair_longhawk": "Long Mohawk",
  "hair/bald/hair_shorthawk": "Short Mohawk",
  "hair/curly/hair_jewfro": "Curly Fro",
  "hair/short/hair_plain": "Plain Short",
  "hair/short/hair_single": "Single Lock",
  "hair/xlong/hair_sara": "Extra Long Straight",
  "head/eyes/eyes_cyclops2": "Cyclops Eyes 2",
  "head/heads/human/heads_human_elderly_small": "Small Elderly",
  "head/heads/human/heads_human_female": "Female",
  "head/heads/human/heads_human_female_elderly": "Elderly Female",
  "head/heads/human/heads_human_female_small": "Small Female",
  "head/heads/human/heads_human_male": "Male",
  "head/heads/human/heads_human_male_elderly": "Elderly Male",
  "head/heads/human/heads_human_male_gaunt": "Gaunt Male",
  "head/heads/human/heads_human_male_plump": "Plump Male",
  "head/heads/human/heads_human_male_small": "Small Male",
  "headwear/accessories/earrings/facial_earring_left": "Earring (Left)",
  "headwear/accessories/earrings/facial_earring_right": "Earring (Right)",
  "headwear/accessories/eyepatch/facial_eyepatch2_left": "Eyepatch 2 (Left)",
  "headwear/accessories/eyepatch/facial_eyepatch2_right": "Eyepatch 2 (Right)",
  "headwear/accessories/eyepatch/facial_eyepatch_ambi": "Eyepatch (Either Eye)",
  "headwear/accessories/eyepatch/facial_eyepatch_left": "Eyepatch (Left)",
  "headwear/accessories/eyepatch/facial_eyepatch_right": "Eyepatch (Right)",
  "headwear/accessories/eyepatch/facial_eyepatch_small_left": "Small Eyepatch (Left)",
  "headwear/accessories/eyepatch/facial_eyepatch_small_right": "Small Eyepatch (Right)",
  "headwear/accessories/monocle/facial_monocle_left": "Monocle (Left)",
  "headwear/accessories/monocle/facial_monocle_right": "Monocle (Right)",
  "headwear/hats/athwart/hat_bicorne_athwart_admiral": "Admiral's Bicorne",
  "headwear/hats/athwart/hat_bicorne_athwart_admiral_cockade": "Admiral's Cockade",
  "headwear/hats/athwart/hat_bicorne_athwart_basic": "Bicorne",
  "headwear/hats/athwart/hat_bicorne_athwart_captain": "Captain's Bicorne",
  "headwear/hats/athwart/hat_bicorne_athwart_commodore": "Commodore's Bicorne",
  "headwear/hats/caps/hat_cap_bonnie": "Bonnie Cap",
  "headwear/hats/caps/hat_cap_bonnie_feather": "Bonnie Cap Feather",
  "headwear/hats/caps/hat_cap_bonnie_tilt": "Tilted Bonnie Cap",
  "headwear/hats/foreaft/hat_bicorne_foreaft": "Fore-and-Aft Bicorne",
  "headwear/hats/foreaft/hat_bicorne_foreaft_commodore": "Commodore's Fore-and-Aft Bicorne",
  "headwear/hats/magic/hat_magic_wizard": "Wizard Hat",
  "headwear/hats/tricorne/hat_tricorne_captain": "Captain's Tricorne",
  "headwear/hats/tricorne/hat_tricorne_lieutenant": "Lieutenant's Tricorne",
  "headwear/helmets/helmets/hat_helmet_armet": "Armet Helmet",
  "headwear/helmets/helmets/hat_helmet_armet_simple": "Simple Armet Helmet",
  "headwear/helmets/helmets/hat_helmet_barbarian": "Barbarian Helmet",
  "headwear/helmets/helmets/hat_helmet_barbarian_nasal": "Barbarian Nasal Helmet",
  "headwear/helmets/helmets/hat_helmet_barbarian_viking": "Barbarian Viking Helmet",
  "headwear/helmets/helmets/hat_helmet_flattop": "Flat-Top Helmet",
  "headwear/helmets/helmets/hat_helmet_legion": "Legion Helmet",
  "headwear/helmets/helmets/hat_helmet_mail": "Mail Coif",
  "headwear/helmets/helmets/hat_helmet_maximus": "Maximus Helmet",
  "headwear/helmets/helmets/hat_helmet_morion": "Morion Helmet",
  "legs/legs_armour": "Leg Armour",
  "torso/armour/torso_armour_leather": "Leather Armour",
  "torso/armour/torso_armour_legion": "Legion Armour",
  "torso/armour/torso_armour_plate": "Plate Armour",
  "torso/cape/cape_solid": "Cape",
  "torso/cape/cape_tattered": "Tattered Cape",
  "torso/shirts/sleeveless/torso_clothes_sleeveless1": "Sleeveless",
  "torso/vest/torso_clothes_vest_open": "Open Vest",
  "weapons/shields/heater/shield_heater_revised_wood": "Heater Shield",
  "weapons/shields/heater/shield_heater_wood": "Heater Shield (Classic)",
};

/** Words that stay lower case inside a name. */
const SMALL = new Set(["and", "with", "of"]);

/** General clean-up for names without a specific rename. */
function tidy(raw: string): string {
  const s = raw
    .replace(/\bw\//g, "with ")
    .replace(/\bXLong\b|\bXlong\b/g, "Extra Long")
    .replace(/\bTShirt\b/g, "T-Shirt")
    .replace(/\bVNeck\b/g, "V-Neck")
    .replace(/\bLongsleeves?\b/g, "Long Sleeve")
    .replace(/\bShortsleeves?\b/g, "Short Sleeve")
    .replace(/\bBangs(short|long)(?![a-z])/gi, (_, len: string) => `${len} Bangs`)
    .replace(/\bShoulder([lr])\b/g, (_, side: string) => `Shoulder ${side === "l" ? "Left" : "Right"}`)
    .replace(/\bHalfmessy\b/g, "Half Messy")
    .replace(/\bAlt\b/g, "2")
    .replace(/([A-Za-z])1\b/g, "$1")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return s
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function displayName(id: string, raw: string): string {
  return RENAMES[id] ?? tidy(raw);
}
