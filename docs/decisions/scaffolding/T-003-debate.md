# T-003 Deliberation: Install shadcn/ui and Configure Theme

## PROPOSER
Initialize shadcn/ui using `npx shadcn@latest init` with new-york style, OKLCH colors. This will generate `components.json`, `src/lib/utils.ts`, and update `globals.css` with OKLCH theme variables in a `@theme {}` block. Then install the specified base components: button, input, label, dialog, dropdown-menu, sonner, card, badge, separator, scroll-area, tooltip.

Key settings:
- Style: new-york
- Colors: OKLCH
- Animation: tw-animate-css (NOT tailwindcss-animate)
- Toast: sonner (NOT old toast)

## CRITIC
- Will `shadcn init` try to create a `tailwind.config.ts`? With latest shadcn + Tailwind 4, it should detect CSS-only config and skip it. If it does create one, we must delete it.
- Does the `@theme` block format match what CLAUDE.md expects? shadcn's latest versions output `@theme inline {}` — need to verify and adjust if needed.
- The `tw-animate-css` package needs explicit installation and import in globals.css.
- sonner compatibility with Next.js 16 + Turbopack should be verified via build.
- Ensure no conflicts with the minimal globals.css we set up in T-002.

## MEDIATOR — Resolution
The Proposer's approach is correct. The Critic's concerns are valid and will be addressed by:
1. Post-init check for tailwind.config.ts and delete if present
2. Verifying globals.css output format matches CLAUDE.md spec
3. Explicit tw-animate-css installation
4. Build verification at the end

See T-003-plan.md for the final implementation plan.
