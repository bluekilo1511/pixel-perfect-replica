<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Game rules live as pure functions in src/lib/tracker/{model,gamify,extras,boss}.ts with vitest tests; components/store only wire them, so rules stay testable without browser APIs.
- Browser-only modules (timeCapsule.ts IndexedDB, ambient.ts Web Audio, html2canvas-pro dynamic import) are called only from effects/handlers to stay SSR-safe.
- Every new persisted field must be normalized in migrate() so old JSON files load safely.
- SkyExperience owns transient focus/ripple presentation; the pure streak model owns active freeze lifecycle so saved JSON can restore frost without changing reward rules.
