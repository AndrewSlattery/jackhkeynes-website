# `_data/` — source data you edit (build-time only)

Files here are **source you edit**. Jekyll auto-loads every `.csv` / `.yml` /
`.json` in this folder into the `site.data` variable at build time. **Nothing here
is ever published** — none of it is downloadable from the live site.

Put hand-edited data here: clue lists (`.csv`), indicator word lists
(`indicators/*.yml`), the header menu (`navigation.yml`).

Do **not** put browser-facing files here (JS, CSS, images, fetched JSON) — those
go in `assets/`. The generated JSON the site serves (e.g.
`assets/data/clues.json`) is built *from* these files; edit the source here, and
the JSON regenerates on the next build.

`external_dictionary/` is a git submodule and is intentionally skipped by the data
loader (see `_plugins/skip_external_data.rb`).

See [`/ARCHITECTURE.md`](../ARCHITECTURE.md) for the full explanation.
