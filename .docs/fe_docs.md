# Frontend documentation (Nudgly)

React app (Vite, TypeScript) with React Router. Health check and authentication (login, register, password reset, OAuth with Google — Apple disabled for development — protected routes) implemented.

## Project structure

- **src/main.tsx** — Entry; mounts `App` with `StrictMode`.
- **src/App.tsx** — Root: `AuthProvider`, `BrowserRouter`, `AppHeader`, and routes. Protected route wraps home.
- **src/config/api.ts** — `API_BASE_URL` from `VITE_API_BASE_URL` (default `http://localhost:8000`).
- **src/contexts/AuthContext.tsx** — Auth state (user, tokens), actions (login, register, loginWithOAuthTokens, logout, password reset), and `getApiDeps()`. Restores session on load via refresh token.
- **src/services/healthApi.ts** — `fetchHealth(baseUrl)` for `GET /health/`.
- **src/services/authApi.ts** — Register, login, logout, passwordResetRequest, passwordResetConfirm, refreshAccessToken, getMe, getMeWithToken, getGoogleAuthorizeUrl, getAppleAuthorizeUrl. Uses `API_BASE_URL` and `/api/auth/` paths.
- **src/components/OAuthButtons.tsx** — “Sign in with Google” (links to backend) and “Sign in with Apple” (disabled for development; will be enabled once the app is further along); both use provider icons.
- **src/services/apiClient.ts** — `authFetch`, `authGet`, `authPost`: attach Bearer token, on 401 try refresh then retry; on failure call `onUnauthorized`. Used by authenticated API calls.
- **src/components/AppHeader.tsx** — App name and Log out button when authenticated.
- **src/components/ProtectedRoute.tsx** — Renders children when authenticated; redirects to `/login` when not; shows loading while auth is resolving.
- **src/pages/** — HealthScreen, LoginScreen, RegisterScreen, PasswordResetRequestScreen, PasswordResetConfirmScreen, AuthCallbackScreen (OAuth callback: reads tokens from fragment, applies auth, redirects).
- **src/styles/theme-tokens.css** — Semantic theme tokens (Teal / Mystic Aqua Serenity); loaded before global CSS.
- **src/types/auth.ts** — `AuthUser`, `LoginRegisterResponse`, `TokenRefreshResponse`.

## Routes

| Path | Description |
|------|--------------|
| `/` | Home (health screen); protected, redirects to `/login` if not authenticated. |
| `/login` | Login form; redirects to home (or `from`) on success. Accepts `?oauth_error=...` (e.g. `not_authenticated`); shows a message and strips the query. |
| `/register` | Register form (email, username, password). |
| `/reset-password` | Request password reset (email). |
| `/reset-password/confirm` | Set new password (query `?token=...`). |
| `/auth/callback` | OAuth callback: backend redirects here with `#access=...&refresh=...`; page applies tokens and redirects to `/`. |

## Auth flow

- **Login/Register:** `authApi.login` or `authApi.register` returns `user`, `access`, `refresh`. Auth context stores user and access in memory, refresh in `localStorage` under `nudgly_refresh_token`.
- **OAuth:** User clicks “Sign in with Google” (links to backend `/api/auth/oauth/google/authorize/`). Apple is shown as a disabled button (“Sign in with Apple (coming soon)”) for development and will be enabled later. Backend redirects to provider then to `/api/auth/oauth/complete/`, which redirects to `{origin}/auth/callback#access=...&refresh=...`. AuthCallbackScreen parses the fragment, calls `loginWithOAuthTokens(access, refresh)` (which fetches user via `getMeWithToken` and stores tokens), then navigates to `/`. If the user reaches the complete URL without a session, the backend redirects to `/login?oauth_error=not_authenticated`; LoginScreen shows a message and removes the query param.
- **Session restore:** On load, if a refresh token exists, context calls `authApi.refreshAccessToken`, then `authApi.getMe`, and sets user and access token.
- **Authenticated requests:** Use `getApiDeps()` from `useAuth()` to build `{ getAccessToken, refreshTokens, onUnauthorized }` and pass to `authGet`/`authPost` (or a wrapper). The client attaches `Authorization: Bearer <access>` and on 401 attempts refresh and retries once.
- **Logout:** Context calls `authApi.logout(refreshToken)` (blacklist) and clears state and `localStorage`.

## Styling and accessibility

- **Style guide:** [.docs/Design Docs/style-guide.md](.docs/Design%20Docs/style-guide.md) — Mystic Aqua Serenity palette, flat design, responsive, WCAG AA.
- **Theme tokens:** All themeable colors use **semantic tokens only** (see [.docs/Design Docs/theme-tokens.md](.docs/Design%20Docs/theme-tokens.md)). Tokens are defined in `src/styles/theme-tokens.css` and loaded in `main.tsx` before `index.css`. Do not add hard-coded hex or Tailwind palette literals for theme colors. Components use `var(--color-*)` (e.g. `--color-text`, `--color-surface`, `--color-accent`, `--color-focus`).
- **Breakpoints:** The app uses plain CSS with breakpoint-based responsive layout. Use these values for consistency (aligned with common Tailwind equivalents): `640px` (sm), `768px` (md), `1024px` (lg), `1280px` (xl). Example: `@media (min-width: 768px) { ... }`. Tailwind is not currently a dependency; new layout can adopt Tailwind later if desired.
- **Touch targets:** Interactive elements minimum 24×24 CSS pixels (WCAG 2.2 SC 2.5.8). The global navbar (AppHeader) uses 44px for nav controls. Auth and Health screens use 24px+ for buttons/inputs.
- **Flat design:** No gradients, heavy shadows, or skeuomorphism; solid fills and simple borders. Visible focus via `var(--color-focus)`.
- **IDs:** All interactive and landmark elements (including labels) have unique, descriptive `id`s per project rules (e.g. `login-email-input`, `login-email-label`, `register-submit-btn`).

## Running and testing

- **Dev:** `npm run dev` (Vite). Set `VITE_API_BASE_URL` for API (e.g. empty when behind nginx on same origin, or `http://localhost:8000` for local Django).
- **Build:** `npm run build`.
- **Tests:** `npm run test` (Vitest). Health, ProtectedRoute, LoginScreen, RegisterScreen, PasswordResetRequestScreen, PasswordResetConfirmScreen, AuthCallbackScreen, and OAuth buttons tests included; auth context and API are mocked in component tests.
