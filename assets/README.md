# `assets/` — published files the site serves (runtime)

Everything here is **copied verbatim into the built site** and is downloadable at
`https://jackhkeynes.co.uk/assets/...`. This is what the browser loads while
someone is on a page: stylesheets (`css/`), scripts (`js/`), puzzle files
(`ipuz/`), and JSON fetched by JavaScript (`data/`, `boralverse/`).

The JSON files in `data/` and `boralverse/` are **generated at build time** from
sources in `_data/`:

- `data/clues.json` ← `_data/clues.csv`
- `data/indicators.json` ← `_data/indicators/*.yml`
- `boralverse/*.json` ← built by the Ruby plugins in `_plugins/`

Don't hand-edit those generated JSON files — edit the source in `_data/` instead.

Hand-edited data (clue lists, word lists, menu) does **not** belong here; it goes
in `_data/`.

See [`/ARCHITECTURE.md`](../ARCHITECTURE.md) for the full explanation.
