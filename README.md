# Pangea

The control surface for the SESSION systematic trading platform. One codebase, two
installs: a phone app added from the browser and a native desktop app.

Four screens — NOW, STRATEGIES, TRADES, RESEARCH — plus the graduated controls and the
manual-trade modal from §17 of the build brief. The engine is not here; this app reads
it and sends it four commands.

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # static bundle in dist/
npm run desktop    # native window (needs Rust)
```

## Installing it

| Target | How |
|---|---|
| iPhone / iPad | Open the deployed URL in Safari → Share → **Add to Home Screen** |
| Android | Open in Chrome → **Install app** (the in-app prompt appears automatically) |
| Desktop, no build | Open in Chrome/Edge → install icon in the address bar. Runs in its own window, offline shell. |
| Desktop, native | `npm run desktop:build`, or run the **Desktop installers** workflow / push a `v*` tag for signed-shaped `.dmg`, `.exe` and `.AppImage` artifacts |

## Connecting the engine

With no configuration the app runs on a deterministic demo feed, labelled `DEMO DATA`
on every screen. Point it at the real service and the label disappears:

```
VITE_API_BASE=https://engine.internal
```

Contract the FastAPI service must satisfy — see `src/lib/types.ts` for the exact shapes:

| Method | Path | Body / result |
|---|---|---|
| `GET` | `/api/snapshot` | `Snapshot` — account, positions, strategies, trades, research. Every payload carries `asOf`. |
| `POST` | `/api/control` | `{ action: 'halve' \| 'pause_entries' \| 'stop_everything' \| 'resume' }` |
| `POST` | `/api/orders/manual` | `{ symbol, side, riskPct, stop }` → `{ accepted, reason? }` |

## Signing in

With `VITE_API_BASE` set the app signs in against the engine: a platform passkey
(Face ID / Touch ID / Windows Hello) verified server-side, plus a Google Authenticator
code when one is enrolled. The session is an httpOnly cookie, so nothing in the bundle
can read or mint one. The first device asks for the engine's `PANGEA_ENROLL_CODE`, and
enrolling an authenticator shows a QR to scan.

With `VITE_API_BASE` empty there is no engine to authenticate against, so the app falls
back to the keypad — a device gate that only stops someone picking up an unlocked phone,
not authentication, because the passcode ships in the bundle.

There is deliberately no endpoint for changing a risk limit, an allocation or a
parameter. Those live in version-controlled config and need a service restart, so the
app physically cannot loosen a limit (§12, §17).

## Rules this app enforces

- **No number without a timestamp.** Anything older than 60s is marked stale in red; on
  a failed fetch the app shows an honest error instead of the last known value.
- **API responses are never cached by the service worker.** Only the shell is, so the
  kill switch loads on bad wifi — but the numbers behind it are always live or absent.
- **`STOP EVERYTHING` has no confirmation dialog**, and `HALVE` / `PAUSE ENTRIES` sit
  above it, because a binary choice makes people freeze or over-react.
- **Bounded inputs only.** Manual risk is 0.25–1% from a selector and stops are
  volatility-derived presets. No free-text sizing anywhere.
- **Session boundaries are resolved through the IANA database at query time**, so
  London is 07:00 UTC in July and 08:00 UTC in January (`src/lib/sessions.ts`).
- **Motion is confined to the mark.** The coin turns on the lock screen and in the
  header; the data surfaces don't animate, and nothing moves under
  `prefers-reduced-motion`.

## Stack, and where it departs from the brief

| Brief | Built | Why |
|---|---|---|
| Next.js | Vite + React 19 | The app is a static client against one API. A Node server adds a deploy target and a cold start for nothing. |
| Electron implied for desktop | PWA first, Tauri 2 optional | The PWA already installs on macOS, Windows and Android from the same bundle. Tauri wraps it in ~10 MB against Electron's ~120 MB when a real installer is wanted. |
| Recharts | ~40 lines of SVG | Two polylines and two bar charts do not justify a charting dependency on a surface budgeted at 100 ms. |
| Tailwind + TanStack Query | unchanged | Tailwind v4 needs no config file; Query gives refetch-on-focus and staleness for free. |

Bundle: ~82 kB gzipped JS, no runtime dependencies beyond React and TanStack Query.

## Layout

```
src/
  lib/       types, formatting, session calendar, API client, demo feed
  components/ coin, controls, manual-trade modal, chart, primitives
  screens/   Lock, Now, Strategies, Trades, Research
src-tauri/   desktop shell (a window; no logic)
scripts/     regenerate app icons from the coin artwork
```

## Not built, on purpose

No parameter tuning, no backtest launching, no leverage control, no news feed, no
prediction or confidence display, no performance projection (§17).
