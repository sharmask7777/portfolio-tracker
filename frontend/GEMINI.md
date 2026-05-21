# Frontend Development Guidelines

## Responsiveness & Adaptability
All UI components must be responsive and adapt to various form factors (Mobile, Tablet, Desktop).

### Standards
- **Mobile-First Approach:** Always consider how a component will look on a 320px-375px screen first.
- **No Fixed Widths:** Avoid fixed `width` or `height` on containers. Use `max-width`, `min-width`, and `auto` instead.
- **Flex & Grid:** Use `flex-wrap: wrap` and `minmax(0, 1fr)` to prevent overflow in layout containers.
- **Media Queries:** Use media queries for structural changes (e.g., stacking columns on mobile).
  - Mobile: `< 768px`
  - Small Mobile: `< 480px`
- **Avoid Inline Styles for Layout:** Move layout-related styles to `App.css` or component-specific CSS to allow media query overrides.

### Guardrails
- **Automated Tests:** Any new layout or major UI change must be verified with Playwright tests at multiple viewports.
- **Regression Check:** Run `npm run test:e2e tests/responsiveness.spec.ts` before committing UI changes.
