# zsh does not word-split variables, and expands unquoted globs in flags

**Date:** 2026-10-13

## What happened
- `DOCS=$(ls docs/*); node script.mjs $DOCS` passed every path as **one** argument, joined by newlines, so the script failed with ENOENT.
- `grep --include=*.js` failed with "no matches found", because zsh tried to expand the glob itself.
- A literal `=====` in an `echo` was read as zsh's `=cmd` expansion.

## Root cause
The shell is zsh, not bash. Unquoted `$VAR` is not split on whitespace, and unmatched globs are an error (`NOMATCH`) instead of passing through literally.

## Rule
- Pipe lists to `xargs`, or use `${=VAR}`, instead of relying on word splitting.
- Quote glob-shaped arguments (`--include='*.js'`) and separator strings (`echo '---'`).
- Quote path variables in `rm` and similar commands (`"${SP:?}"/x`), so an empty variable can never expand to `/`.
