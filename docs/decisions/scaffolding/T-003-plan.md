# T-003 Implementation Plan: Install shadcn/ui and Configure Theme

1. Run `npx shadcn@latest init` with new-york style, OKLCH colors
2. Install `tw-animate-css` if not auto-installed by shadcn
3. Verify and delete any `tailwind.config.ts` if created
4. Install base components: button, input, label, dialog, dropdown-menu, sonner, card, badge, separator, scroll-area, tooltip
5. Ensure `globals.css` contains:
   - `@import "tailwindcss"`
   - `@import "tw-animate-css"`
   - `@theme { }` block with OKLCH `--color-*` and `--radius-*` variables
6. Verify `src/lib/utils.ts` exists with `cn` utility
7. Run `npm run build` — must pass
