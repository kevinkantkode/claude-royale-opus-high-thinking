# Ref Pattern Reference

## Closures vs Refs

**Closures capture values at creation time:**
```ts
const handlePlay = useCallback(() => {
  if (pending) return  // "pending" captured when function is created
  // ...
}, [pending])  // New function whenever pending changes
```

**Refs read at call time:**
```ts
const pendingRef = useRef(pending)
pendingRef.current = pending  // Updated every render

const handlePlay = useCallback(() => {
  if (pendingRef.current) return  // Read when handler runs
  // ...
}, [])  // Stable - no deps needed
```

## Safe vs Unsafe

**Safe when:**
1. Update ref every render: `ref.current = value`
2. Read only in event/callback (click, keypress, async callback)
3. Never use for rendering (e.g. `return <div>{ref.current}</div>`)

**Unsafe when:**
1. Forget to update the ref
2. Use in render (React won't re-render when `.current` changes)
3. Read in a context where the value might be stale

## Ref Usage Table

| Ref | Updated | Read when | Purpose |
|-----|---------|-----------|---------|
| `pendingRef` | Every render | Handler runs | Avoid stale `pending` in callbacks |
| `queueRef` | Every render | Keypress | Keyboard handler sees latest queue without effect deps |
| `handlePlayRef` | Every render | Keypress / card click | Stable handler reference for effects and children |

## Limitations

**Card grid + elixir:** The card grid needs `elixir` for `canRecordPlay` (disabled state). When elixir changes (every 100ms), the grid must re-render to update buttons. Splitting cannot avoid this without dropping the elixir-dependent disabled state. React.memo on CardDisplay still helps by skipping the child component when its props (card, variant) are unchanged.
