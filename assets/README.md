# `assets/` — published files the site serves (runtime)

Everything here is **copied verbatim into the built site** and is downloadable at
`https://jackhkeynes.co.uk/assets/...`. This is what the browser loads while
someone is on a page: stylesheets (`css/`), scripts (`js/`), puzzle files
(`ipuz/`), and JSON fetched by JavaScript (`data/`, `boralverse/`).

## `ipuz/` — puzzle files, one subfolder per series

| Subfolder | Series | File naming |
|---|---|---|
| `cryptic/` | The main numbered run | `1.ipuz` … `351.ipuz` |
| `general-knowledge/` | General Knowledge | `General Knowledge 1.ipuz` |
| `bluejacket/` | Independent / Bluejacket | `Independent - 01 - Bluejacket.ipuz` |
| `spiral/` | Spirals | `Spiral 1.ipuz` |
| `outtakes/` | Outtakes | `Outtake 1 - Seven by Five.ipuz` |
| `collab/` | Collaborations | `Collab 1.ipuz` |
| `other/` | One-offs that fit no series | `SudoCross 1.ipuz` |

**A post never names the subfolder.** It gives only the bare puzzle name in its
front matter (`puzzle_number: 137`, `puzzle_number: "Spiral 3"`), and
`puzzleFolder()` in `assets/js/crossword-core.js` derives the folder from that
name. So when you add a puzzle, **the filename must match its series pattern
above** — that pattern is what routes it. A new series means adding a row to the
`PUZZLE_FOLDERS` table in `crossword-core.js`; anything unrecognised falls back
to `other/`.

The JSON files in `data/` and `boralverse/` are **generated at build time** from
sources in `_data/`:

- `data/clues.json` ← `_data/clues.csv`
- `data/indicators.json` ← `_data/indicators/*.yml`
- `boralverse/*.json` ← built by the Ruby plugins in `_plugins/`

Don't hand-edit those generated JSON files — edit the source in `_data/` instead.

Hand-edited data (clue lists, word lists, menu) does **not** belong here; it goes
in `_data/`.

See [`/ARCHITECTURE.md`](../ARCHITECTURE.md) for the full explanation.
