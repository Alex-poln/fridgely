# Nutrition workflow update

Apply supabase/migrations/004_dish_consumption.sql in the Supabase SQL editor after the existing nutrition schema. No Edge Function redeployment is needed: ingredient estimates use the existing nutrition endpoint (one request per incomplete ingredient).

## Required live checks
- Recipe for 2 portions requiring 200 g chicken, stock 150 g: cook consumes 150 g, missing 50 g does not block.
- Eat 1 portion after cooking: diary receives one portion; inventory stays unchanged.
- Eat 1 portion before cooking: deduct only 100 g; cooking later deducts the remaining 50 g.
- Repeat the same request UUID: only one diary entry and stock deduction.
- Another account cannot log or cook another owner's dish.
- Custom dish: 50 g of a product with 400 kcal per 100 g contributes 200 kcal; 2 recipe portions each receive 100 kcal.
- Missing nutrition remains unknown until supplied or estimated; manual known fields survive AI estimates.
- Change goal and check all four targets, then reload. Explicit protein factor override is retained.
- On iPhone and iPad: advance/back through forms, open keyboard, provoke server failure, verify error is inside dialog.
- Existing diary edits change the diary only, not historical stock. Deleting entries likewise does not replenish stock.

Cooking refers to one batch of the saved recipe. Repeated eating beyond that batch deducts additional portions. Existing recipes marked cooked are initialized as prepared; older diary entries are retained but do not retroactively consume inventory. Free-name ingredients match owned products by exact case-insensitive name and unit; no speculative product matching occurs. Available stock is used earliest-expiry first; shortage is skipped, never subtracted below zero.

Automated arithmetic and JS syntax checks do not replace live Supabase transaction checks or Safari layout testing.
