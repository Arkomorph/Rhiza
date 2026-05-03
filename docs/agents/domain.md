# Domain docs

Single-context layout.

- `CONTEXT.md` at the repo root — domain language and shared vocabulary
- `docs/adr/` — Architecture Decision Records (short, numbered)

## Consumer rules

- Read `CONTEXT.md` before any skill that reasons about architecture or domain
- Use the terms defined there — not synonyms, not paraphrases
- If a term is missing or ambiguous, flag it to the user rather than guessing
- ADRs are append-only; to supersede one, create a new ADR that references the old
