# QA report - Brand Kit 1.0

## Automated checks

- 8 SVG files parsed as valid XML and include accessible `<title>` metadata.
- 11 PNG files opened and verified successfully.
- App icons verified at exactly 512×512 and 192×192; both are fully opaque.
- Mobile previews verified at 780×1688; brand board verified at 1600×1000.
- `design-tokens.json` parsed successfully.
- All 12 local links and image references in `index.html` resolve.
- The nine required screen roles, the Gil/Nurit origin line, partial-basket language and timestamp guidance are present in the specification.

## Contrast checks

| Pair | Ratio | Result |
|---|---:|---|
| Deep purple / warm white | 16.79:1 | AAA |
| White / deep purple | 17.54:1 | AAA |
| Turquoise / deep purple | 10.72:1 | AAA |
| Orange / deep purple | 6.71:1 | AA |
| Hot pink / deep purple | 4.67:1 | AA |
| Fresh text / fresh surface | 6.47:1 | AA |
| Aging text / aging surface | 6.82:1 | AA |
| Missing text / missing surface | 8.05:1 | AAA |
| Muted text / white | 6.51:1 | AA |

Ratios use the WCAG relative-luminance formula. Bright brand colors are not approved as small text on white; use the documented dark text pairings.

## Visual review

- Hebrew wordmark renders in the intended RTL order in the provided previews.
- Mobile navigation uses a right-facing back arrow on the top-right.
- Prices remain LTR and align with tabular numerals.
- Freshness and missing-item states include words and counts in addition to color.
- The winner card is a complete 24/24 basket; incomplete cards do not receive a winner label.
- No clipping, overlap or unsupported status glyphs remain in the final PNG previews.
