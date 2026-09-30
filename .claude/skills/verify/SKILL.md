---
name: verify
description: Run full verification pipeline — lint, typecheck, and tests. Use before committing or when you want to confirm everything passes.
---

Run the following commands sequentially, stopping on first failure:

1. **Lint**: `npm run lint`
2. **Typecheck**: `npx tsc --noEmit`
3. **Tests**: `npm run test`

If any step fails:
- Report the specific errors
- Suggest fixes
- Re-run only the failed step after fixing

If all pass, report a brief summary: what was checked and that everything is green.
