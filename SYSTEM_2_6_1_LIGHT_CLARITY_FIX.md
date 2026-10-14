# THE SYSTEM 2.6.1 — Light Clarity Fix

This patch is based on the 2.6.0 Class Growth + Fuel build.

## Fixed

- Quest proof popup is now rendered in a top-level modal layer, so it stays centered in the visible viewport and does not jump down the Quest page.
- Class Special screens now have dark, readable copy and distinct bordered panels in Light mode.
- Fuel System uses the same readable Light-mode treatment, including its goal cards, inputs, summaries and meal log.
- Assassin now uses a dedicated black-and-crimson blade atmosphere asset rather than the purple source emblem.

## Unchanged

- Quest visuals, proof rules, validation and backend progression behavior.
- Existing dark theme treatment.
- Supabase configuration and local environment files.

## Verify after installing

1. Open a Quest proof from lower down the Quest page: the popup should appear in the middle of the screen.
2. Close it: the page should remain at the same scroll position.
3. Switch to Light mode, then open Class Special and Fuel System: headings, body copy, cards and controls should be clearly readable.
