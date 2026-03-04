---
name: react-performance-optimization
description: Proactively suggests React performance optimizations when editing components. Use when inline handlers in loops, frequent re-renders, setInterval/setTimeout in root, or components that could benefit from memo or splitting are detected.
---

# React Performance Optimization

## When to Apply

Proactively suggest optimizations when you detect:

- Inline handlers in `.map()` or loops (e.g. `onClick={() => handleX(item.id)}`)
- `useCallback` with deps that change often (e.g. `[pending]`, `[opponentState]`)
- `useEffect` with deps that change on every user action
- Child components with stable props whose parent re-renders frequently
- `setInterval` or `setTimeout` in the root component for tick/clock state

## Optimization Checklist

When editing React components, consider:

| Pattern | Fix |
|---------|-----|
| Inline handlers in loops | Single handler + `data-*` attribute (see react-single-handler rule) |
| Callbacks with `[pending]` or similar | Ref pattern (see react-ref-pattern rule) |
| Effects with `[opponentState]` or similar | Ref pattern for values read in effect callback |
| Child with stable props, parent re-renders often | `React.memo` (see react-memo-splitting rule) |
| Tick/interval in root component | Move to a subtree component so only that subtree re-renders |

## GC Note

Reducing allocations (e.g. fewer functions per render) lowers garbage collection pressure. Creating N handlers per render that are discarded on the next render is costly when the parent re-renders frequently (e.g. 10x/sec from a timer).

## Reference

- For ref pattern details: [reference.md](reference.md)
- Project rules: `.cursor/rules/react-ref-pattern.mdc`, `react-memo-splitting.mdc`, `react-single-handler.mdc`
