# Character sprites

The character art in this folder comes from the **Liberated Pixel Cup (LPC)** collection, through the
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
Every piece keeps its original licence (CC0, CC-BY, OGA-BY, CC-BY-SA or GPL). `CREDITS.md` lists the
authors, licences and links for each item that ships. These licences cover the art only, not StudyQuest's own code.

- `items.json`: the catalog index, with items, layer order, atlas positions, palettes and colour maps.
- `atlas.json`: one PNG (base64) with every kept frame pair: the forward-facing idle row, 2 frames of 64×64.
- `CREDITS.md`: generated credits.

## Regenerating

These files are generated, so don't edit them by hand. With a local copy of the generator's `sheet_definitions/`,
`spritesheets/` and `palette_definitions/` folders, run:

```sh
python3 -I scripts/sprites/build_bundle.py <path-to-lpc-checkout> assets/sprites
```

The script needs Pillow. It stops if the bundle goes over about 1.1 MB or if any item is missing from the credits.
