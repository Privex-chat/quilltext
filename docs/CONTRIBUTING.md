# Contributing

Thanks for your interest in Quilltext.

---

## How to Contribute

1. **Fork** the repository at [github.com/Privex-chat/quilltext](https://github.com/Privex-chat/quilltext)
2. **Create a feature branch** (`git checkout -b feature/my-feature`)
3. **Make your changes** following the guidelines below
4. **Run checks** (`npm run check`)
5. **Commit and push**
6. **Open a Pull Request**

---

## Development Setup

```bash
npm install
npm run dev      # Start Vite dev server with hot reload
npm run build    # TypeScript check + production build
npm run check    # TypeScript check only (no build)
npm run preview  # Serve the production build locally
```

No framework dependencies beyond what `package.json` specifies.

---

## Code Style

- **Language**: TypeScript (strict mode, `noUnusedLocals`, `noUnusedParameters`)
- **Formatting**: No Prettier/ESLint config yet. Maintain consistency with the existing code.
- **Naming**: camelCase for variables and functions, PascalCase for classes and types, UPPER_CASE for constants
- **No framework**: Keep the engine (`src/engine/`) free of DOM dependencies
- **No comments**: Only add comments to explain why something non-obvious is done, not what the code does
- **Imports**: Use ES module imports; sort them logically (engine, state, ui)

---

## Architecture Guidelines

### Engine (`src/engine/`)
- Must have zero DOM/UI dependencies
- Must accept all rendering parameters explicitly (no singletons, no globals)
- Should be portable to Web Workers and Node.js

### State (`src/state/`)
- The `Store` singleton is the single source of truth for settings, document, and atlas
- Mutations go through `Store.set()` / `Store.patch()` / `Store.setDoc()` -- never mutate `store.settings` directly
- Subscribe to changes with `store.subscribe()` instead of polling

### UI (`src/ui/`)
- Keep DOM manipulation isolated in UI modules
- UI modules read from the store and call the engine; they should not contain rendering logic
- Event handlers should be registered explicitly (no inline onclick attributes)

---

## Pull Request Checklist

- [ ] Code compiles (`npm run check` passes)
- [ ] No new `any` types unless absolutely necessary
- [ ] No new DOM dependencies in `src/engine/`
- [ ] Changes are tested manually (preview + export match)
- [ ] Commit messages are clear and descriptive

---

## Reporting Issues

Open a GitHub issue with:
- A clear title and description
- Steps to reproduce (if a bug)
- Expected vs actual behavior
- Browser and OS information

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
