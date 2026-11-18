"""Build StudyQuest's sprite bundle from a local LPC checkout.

Usage:  python3 -I scripts/sprites/build_bundle.py <lpc-checkout> assets/sprites

<lpc-checkout> is a copy of the Universal LPC Spritesheet Character Generator with its
sheet_definitions/, spritesheets/ and palette_definitions/ folders. It is read as data only.

Writes:
  items.json   catalog index: items, layers, atlas rects, palettes, colour maps
  atlas.json   {"png": "<base64>"}: every kept frame pair in one PNG
  CREDITS.md   authors, licences and links for every shipped item

Kept: the forward-facing idle row (2 frames, 64x64) for the male and female bodies, for skin,
wings, tails, human heads, faces, eyes, eyebrows, noses, hair, beards, headwear, tops, trousers,
shoes, arm pieces, the arming sword and shields. Recolourable items keep only their base image;
pre-coloured items keep one reference image plus a colour map per variant (or their own image
when the variant isn't an exact colour swap).
"""
import base64, glob, hashlib, io, json, os, sys
from PIL import Image

BODIES = ("male", "female")
FRAME, DOWN_ROW = 64, 2
MAX_BYTES = 1_100_000
ATLAS_COLS = 16
# Layers that only make sense on top of another item.
ADDON_TYPES = {"sleeves", "sash_tie", "shield_pattern", "shield_paint", "hairextl", "hairextr", "ponytail", "updo"}


def is_addon(t):
    return t in ADDON_TYPES or t.endswith("_trim") or t.endswith("_overlay") or t.startswith("dress_sleeves")


def keep(cat, rel, d):
    t = d.get("type_name", "")
    if is_addon(t):
        return False
    if cat in ("headwear", "torso", "legs", "feet", "arms"):
        return True
    if cat == "hair":
        return t in ("hair", "beard", "mustache")
    if cat == "body":
        return t in ("body", "wings", "tail")
    if cat == "head":
        return t in ("expression", "eyes", "eyebrows", "nose") or (t == "head" and "/human/" in rel)
    if cat == "weapons":
        return d["name"] == "Arming Sword" or t == "shield"
    return False


def crop(path):
    im = Image.open(path).convert("RGBA")
    if im.width < 2 * FRAME or im.height < (DOWN_ROW + 1) * FRAME:
        return None
    return im.crop((0, DOWN_ROW * FRAME, 2 * FRAME, (DOWN_ROW + 1) * FRAME))


def hexa(px):
    return "#%02x%02x%02x%02x" % px


def colour_map(ref, var):
    """ref → var as exact RGBA pairs, or None if some reference colour maps to two colours."""
    m = {}
    flat = lambda im: getattr(im, "get_flattened_data", im.getdata)()
    for a, b in zip(flat(ref), flat(var)):
        if a[3] == 0 and b[3] == 0:
            continue
        if m.setdefault(a, b) != b:
            return None
    return [[hexa(a), hexa(b)] for a, b in m.items() if a != b]


def channels(recolors):
    if not recolors:
        return None
    if "material" in recolors:
        return [{"material": recolors["material"]}]
    keys = sorted(k for k in recolors if k.startswith("color_"))
    return [{"material": recolors[k]["material"]} for k in keys if "material" in recolors[k]] or None


def main(src, out):
    os.makedirs(out, exist_ok=True)
    tiles, tile_index = [], {}  # dedupe identical frame pairs

    def place(im):
        key = hashlib.sha1(im.tobytes()).hexdigest()
        if key not in tile_index:
            tile_index[key] = len(tiles)
            tiles.append(im)
        i = tile_index[key]
        return {"x": (i % ATLAS_COLS) * 2 * FRAME, "y": (i // ATLAS_COLS) * FRAME}

    materials, items, credits = set(), [], {}
    defs_root = os.path.join(src, "sheet_definitions")
    for dp, _, fs in sorted(os.walk(defs_root)):
        for f in sorted(fs):
            if not f.endswith(".json") or f.startswith("meta_"):
                continue
            try:
                d = json.load(open(os.path.join(dp, f)))
            except Exception:
                continue
            if not isinstance(d, dict) or "name" not in d or "idle" not in (d.get("animations") or []):
                continue
            rel = os.path.relpath(os.path.join(dp, f), defs_root)
            cat = rel.split(os.sep)[0]
            if not keep(cat, "/" + rel.replace(os.sep, "/"), d):
                continue
            item_id = rel[:-5].replace(os.sep, "/")
            recolor = channels(d.get("recolors"))
            subs = [("", None)]
            for key, table in (d.get("replace_in_path") or {}).items():
                subs = [("@" + v, (key, v)) for v in sorted(set(table.values()))]
            layers, maps, variant_names = [], {}, set()
            for n in range(1, 9):
                layer = d.get("layer_%d" % n)
                if not layer or layer.get("custom_animation"):
                    continue
                frames = {}
                for body in BODIES:
                    raw = layer.get(body)
                    if not raw:
                        continue
                    got = {}
                    for suffix, rep in subs:
                        base_dir = raw.replace("${" + rep[0] + "}", rep[1]) if rep else raw
                        base = os.path.join(src, "spritesheets", base_dir, "idle.png")
                        im = crop(base) if os.path.exists(base) else None
                        if recolor and im is not None:
                            got[suffix] = place(im)
                            continue
                        variants = sorted(glob.glob(os.path.join(src, "spritesheets", base_dir, "idle", "*.png")))
                        ref = None
                        for v in variants:
                            vim = crop(v)
                            if vim is None:
                                continue
                            name = os.path.basename(v)[:-4]
                            variant_names.add(name)
                            if ref is None:
                                ref = (name, vim)
                                got[name + suffix] = place(vim)
                                continue
                            cm = colour_map(ref[1], vim)
                            if cm is None:
                                got[name + suffix] = place(vim)
                            else:
                                maps.setdefault("%s%s|%d|%s" % (name, suffix, n, body), {"ref": ref[0] + suffix, "map": cm})
                        if not variants and im is not None:
                            got[suffix] = place(im)
                    if got:
                        frames[body] = got
                if frames:
                    layers.append({"zPos": layer.get("zPos", 0), "frames": frames})
            if not layers:
                continue
            entry = {"id": item_id, "name": d["name"], "category": cat, "type": d.get("type_name", ""),
                     "matchBodyColor": bool(d.get("match_body_color")), "layers": layers}
            if recolor:
                entry["recolor"] = recolor
                materials.update(c["material"] for c in recolor)
            if variant_names and not recolor:
                entry["variants"] = sorted(variant_names)
            if maps:
                entry["colorMaps"] = maps
            if d.get("replace_in_path"):
                entry["headKinds"] = sorted({v for t in d["replace_in_path"].values() for v in t.values()})
            items.append(entry)
            credits[item_id] = (d["name"], d.get("credits") or [])
    if "body" not in materials:
        materials.add("body")

    palettes = {}
    for m in sorted(materials):
        meta = json.load(open(os.path.join(src, "palette_definitions", m, "meta_%s.json" % m)))
        colors = json.load(open(os.path.join(src, "palette_definitions", m, "%s_ulpc.json" % m)))
        palettes[m] = {"base": colors[meta["base"]], "colors": colors}

    rows = (len(tiles) + ATLAS_COLS - 1) // ATLAS_COLS
    atlas = Image.new("RGBA", (ATLAS_COLS * 2 * FRAME, rows * FRAME))
    for i, t in enumerate(tiles):
        atlas.paste(t, ((i % ATLAS_COLS) * 2 * FRAME, (i // ATLAS_COLS) * FRAME))
    buf = io.BytesIO()
    atlas.save(buf, format="PNG", optimize=True)

    items_json = json.dumps({"palettes": palettes, "items": items}, separators=(",", ":"))
    atlas_json = json.dumps({"png": base64.b64encode(buf.getvalue()).decode("ascii")})
    open(os.path.join(out, "items.json"), "w").write(items_json)
    open(os.path.join(out, "atlas.json"), "w").write(atlas_json)

    lines = ["# Sprite credits", "",
             "StudyQuest's character art comes from the Liberated Pixel Cup (LPC) collection, via the",
             "Universal LPC Spritesheet Character Generator. Each piece keeps its original licence.", ""]
    for item_id in sorted(credits):
        name, cr = credits[item_id]
        lines.append("## %s (`%s`)" % (name, item_id))
        for c in cr:
            if c.get("notes"):
                lines.append("- Notes: %s" % c["notes"])
            lines.append("- Authors: %s" % ", ".join(c.get("authors") or []))
            lines.append("- Licences: %s" % ", ".join(c.get("licenses") or []))
            for u in c.get("urls") or []:
                lines.append("- %s" % u)
        lines.append("")
    open(os.path.join(out, "CREDITS.md"), "w").write("\n".join(lines))

    size = len(items_json) + len(atlas_json)
    missing = [i["id"] for i in items if not credits.get(i["id"], (None, []))[1]]
    print("items: %d, atlas tiles: %d, size: %d bytes (items %d, atlas %d)" % (len(items), len(tiles), size, len(items_json), len(atlas_json)))
    if missing:
        sys.exit("credits: missing for %s" % ", ".join(missing[:10]))
    print("credits: complete")
    if size > MAX_BYTES:
        sys.exit("bundle too large: %d > %d bytes" % (size, MAX_BYTES))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
