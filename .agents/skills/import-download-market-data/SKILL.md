---
name: import-download-market-data
description: Import newly downloaded market-data JSON files into this repository. Use when the user asks to move files from ~/Downloads with prefixes ALL@VIX, 0DTE@SPX, or 1WEEK@SPX into src/data and update src/data/index.json.
---

# Import Download Market Data

Use this skill only in the `indepstate-tape` repository.

## Inputs

- Source directory: `~/Downloads`.
- Destination directory: `src/data/`.
- Index file: `src/data/index.json`.
- Supported filename prefixes:
  - `ALL@VIX` maps to index category `VIX`.
  - `0DTE@SPX` maps to index category `0DTE@SPX`.
  - `1WEEK@SPX` maps to index category `1WEEK@SPX`.

## Workflow

1. Find matching files in `~/Downloads`.
2. Keep only files with the `.json` extension.
3. For each supported prefix, sort matching files by filesystem creation time.
4. Select only the latest file for each prefix.
5. Decode HTML/URL-encoded characters in selected filenames before moving them.
6. Before moving files or editing `src/data/index.json`, tell the user exactly:
   - which files will be moved,
   - what their decoded destination filenames will be,
   - which index categories will be updated,
   - whether any category will be cleared first.
7. Wait for explicit user confirmation.
8. Move the confirmed files into `src/data/`.
9. Update `src/data/index.json`:
   - Append imported filenames as the last entries in their mapped categories by default.
   - If the user asked to clear a category first, replace that category with only the imported file for that category.
10. Validate that `src/data/index.json` is valid JSON and that the moved files exist in `src/data/`.
11. If more than one matching `.json` file existed for any prefix, report that after the import finishes and state which latest file was imported.

## Notes

- Do not import `.txt` or other non-JSON files, even if they have a supported prefix.
- Do not delete or reorder existing index entries unless the user explicitly asks to clear or otherwise modify a category.
- Treat `0DTE` in user wording as category `0DTE@SPX` when the context is this import workflow.
