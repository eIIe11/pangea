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

There is deliberately no endpoint for changing a risk limit, an allocation or a
parameter. Those live in version-controlled config and need a service restart, so the
app physically cannot loosen a limit (§12, §17).

## The API (`server/`)

A FastAPI service that implements the contract above and, first, real authentication.

```
cd server
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env      # fill in SESSION_SECRET, RP_ID, ORIGIN, ENROLL_CODE
.venv/bin/uvicorn app.main:app --reload
```

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/auth/status` | What the lock screen needs: whether anyone is enrolled, whether a session exists, whether a code is owed |
| `POST` | `/api/auth/passkey/enroll/options` \| `/verify` | Registers a platform passkey — Face ID, Touch ID, Windows Hello. Needs `PANGEA_ENROLL_CODE` |
| `POST` | `/api/auth/passkey/login/options` \| `/verify` | Signs in with the passkey. Issues the session, or a 5-minute pending one if an authenticator is enrolled |
| `POST` | `/api/auth/totp/enroll` \| `/enroll/verify` | Returns an `otpauth://` URI and a QR to scan with Google Authenticator; the secret is inert until a code from it verifies |
| `POST` | `/api/auth/totp/login` | Second factor, reachable only after the passkey step |
| `GET` | `/api/market/quotes` | Real quotes for the watchlist, each with the exchange time it was true |
| `GET` | `/api/broker/status` | Whether a broker is connected, and if not, why |

Why the server and not the app: a passkey's private key never leaves the phone's secure
enclave and its signature is checked against a stored public key, and the session is a
signed `httpOnly` cookie the page's JavaScript cannot read or mint. A passcode or a TOTP
check running in the bundle can be read out of the bundle — which is why the keypad on
the lock screen is described as a device gate and nothing more.

Authentication is real now. **Account state is not**: `/api/snapshot` answers `503` with
the reason until an IBKR gateway is configured and connected, and controls and manual
orders answer `{ accepted: false, reason }` saying nothing was sent. An order the
operator believes was routed is worse than a visible refusal.

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
server/
  app/       auth (passkeys, TOTP), sessions, market data, broker seam, engine routes
  tests/     what may move money, and what must refuse to
src-tauri/   desktop shell (a window; no logic)
scripts/     regenerate app icons from the coin artwork
```

## Not built, on purpose

No parameter tuning, no backtest launching, no leverage control, no news feed, no
prediction or confidence display, no performance projection (§17).
