# Security Policy

## Supported Versions

We actively support security updates for the latest version of Cursor Boston. Please ensure you're running the latest version to receive security patches.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Preferred options (pick one):

1. **GitHub private vulnerability reporting** (recommended) — use the **Report a vulnerability** link on the [**Security** tab](https://github.com/rogerSuperBuilderAlpha/cursor-boston/security/advisories/new). This opens a private thread visible to every maintainer and is the fastest path to a fix. It does not depend on email forwarding being configured.
2. **Email:** **security@cursorboston.com** (forwards to the maintainer team).
3. **Fallback:** if you don't get an acknowledgement within 48 hours via either channel, please email **hello@cursorboston.com** with the subject line beginning `[security]` so it lands in the same triage queue used by the rest of the maintainer team. This fallback exists so a misrouted security@ message never delays a disclosure.

For machine-readable disclosure routing, see [`public/.well-known/security.txt`](../public/.well-known/security.txt) (served at `https://cursorboston.com/.well-known/security.txt` in production).

### What to Include

When reporting a vulnerability, please include:

1. **Description** - A clear description of the vulnerability
2. **Steps to Reproduce** - Detailed steps to reproduce the issue
3. **Impact** - Potential impact of the vulnerability
4. **Suggested Fix** - If you have ideas for how to fix it (optional but appreciated)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### What to Expect

- We will acknowledge receipt of your report
- We will investigate and verify the vulnerability
- We will keep you updated on our progress
- We will credit you in the security advisory (if you wish)
- We will work to release a fix as soon as possible

### Disclosure Policy

- We will not disclose the vulnerability publicly until a fix is available
- We will coordinate with you on the disclosure timeline
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

If you're deploying Cursor Boston:

1. **Environment Variables** - Never commit `.env.local` files
   - Verify `.env.local` is in `.gitignore`
   - Use `.env.local.example` as a template (or `.env.local.demo` for zero-config demo mode)
   - Set production environment variables in your deployment platform
   - See [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) for local setup instructions
2. **Firebase Security Rules** - Review and customize Firestore and Storage rules
   - Deploy rules: `firebase deploy --only firestore:rules,storage:rules`
   - Test rules thoroughly before production
   - Review rules regularly for security gaps
3. **Authentication** - Use strong authentication methods
   - Maintainers and committers MUST use **phishing-resistant 2FA** (hardware security keys / FIDO2 / WebAuthn / passkeys). TOTP-only (Authy, Google Authenticator) and SMS are not sufficient for maintainer accounts. The `rogerSuperBuilderAlpha` GitHub organization enforces org-level 2FA — see [`MAINTAINERS.md` § Maintainer account security](../MAINTAINERS.md#maintainer-account-security).
   - Use OAuth providers with proper redirect URIs
   - Regularly review authorized domains in Firebase
4. **HTTPS** - Always use HTTPS in production
   - Ensure SSL certificates are valid and auto-renewing
   - Use HSTS headers where possible
5. **Dependencies** - Keep dependencies up to date: `npm audit`
   - Run `npm audit` regularly
   - Fix vulnerabilities promptly
   - Consider using Dependabot for automated updates
6. **Secrets** - Rotate API keys and secrets regularly
   - Rotate OAuth client secrets periodically
   - Use different secrets for development and production
   - Never hardcode secrets in source code
   - For the project's own rotation cadence and runbook, see [`docs/SECURITY_OPERATIONS.md`](../docs/SECURITY_OPERATIONS.md)
7. **Rate Limiting** - API routes are protected with rate limiting
   - Review rate limit configurations for your use case
   - Monitor for abuse patterns
8. **Input Validation** - Validate all user inputs
   - Sanitize user inputs to prevent XSS
   - Validate file uploads (type, size)
   - Use parameterized queries (Firestore handles this)

## Release integrity

- **Signed releases** — every release after v0.2.2 ships Sigstore-signed SBOMs (`sbom.json.cosign.bundle`, `sbom.spdx.json.cosign.bundle`) and a SLSA L2 build provenance attestation. Verify with [cosign](https://github.com/sigstore/cosign).
- **Signed tags** — release tags from v0.3.0 forward are signed with gitsign or GPG. The release workflow refuses to publish unsigned tags. See [`docs/RELEASING.md` § Signed tags](../docs/RELEASING.md#signed-tags) for verification commands.
- **Branch protection** — `main` and `develop` require PR + review + status checks; `main` additionally enforces `enforce_admins`.

## Preventing Accidental Secret Exposure

To prevent security issues:

- Always verify `.gitignore` includes `.env*` files
- Use `git status` before committing to ensure no sensitive files are staged
- Consider using tools like [git-secrets](https://github.com/awslabs/git-secrets) or [truffleHog](https://github.com/trufflesecurity/trufflehog) to scan for secrets
- Use pre-commit hooks to prevent committing secrets (see [docs/DEVELOPMENT.md - Pre-commit Hooks](../docs/DEVELOPMENT.md#pre-commit-hooks))

## Known Security Considerations

- Firebase API keys are public by design (they're client-side)
- Firestore Security Rules are the primary security mechanism
- Server-side secrets (Discord client secret) must remain private
- Email addresses in code are contact info, not secrets

## Audit — 2026-10-20

Manual pass on `develop` (fork `sheel-PBM/cursor-boston`). Findings below were checked against the code and tests before they were treated as real. Theoretical notes that did not produce a working cross-user result are listed under "Checked and not confirmed."

### Tools

| Tool | Result |
| --- | --- |
| Claude Security (`claude-security`) | Not run. No Claude Code install and no Anthropic login in this environment. |
| Codex Security (`cs scan`) | Not run. Global install of `@openai/codex-security` failed with `EACCES` on `/usr/lib/node_modules`, and there is no OpenAI login. |
| Cloudflare security-audit skill | Followed by hand from the published skill (recon, coverage hunt, fresh recheck of each candidate, write-up). The `npx skills add` installer was not used. |
| Google Mantis | Not run. It needs `gcloud auth application-default login` and an LLM backend; that setup was skipped. |
| `npm audit` | Ran against the production tree (`npm audit --omit=dev`) before and after the dependency pins. |
| `pip-audit` | Not applicable. There is no Python application dependency set; the `.py` files under event folders are submissions. |

### Confirmed

**High — public member records included account email.** `GET /api/members/public` built its snapshot by copying the whole user document. That copy included `email` and `additionalEmails` even when `visibility.showEmail` was off. Firestore rules also let any client read `users/{userId}` when `visibility.isPublic` was true, and Firestore cannot hide individual fields. A visitor could read the email of anyone who had turned on a public profile, including through the unauthenticated directory API. The directory now keeps an allowlist (`lib/public-member.ts`) on snapshot write and again on API read. Client reads of `users/{userId}` are owner-only. Pair and mentorship screens load display names from the sanitized directory.

**High — `emailLookup` was listable by any signed-in user.** Document ids are email addresses and the values include a uid. App code only reads this collection with the Admin SDK. Client read and write are now denied.

**High — `POST /api/notify-admin/cfp` was an open mail path.** The route did not check a Firebase token and emailed both the admin and whatever address was in the body. A caller could send mail from the community domain to an address they do not own. The route now requires a signed-in user, sends the confirmation only to an address on that account (token email, profile email, or a verified `additionalEmails` entry), still notifies the admin, and rate-limits the caller. The CFP page sends the ID token with the notify request.

**Medium — talk and event notify routes had no rate limit.** `POST /api/notify-admin/event` and `POST /api/notify-admin/talk` stay public (they back public forms and only mail `ADMIN_EMAIL`), but they could be called without a limit and burn the Mailgun quota. Both now share an 8-requests-per-15-minutes limit per client.

**Critical (dependency) — Next.js 16.2.6.** Production `npm audit` matched the installed Next.js line to advisories fixed in 16.3.8 (middleware/proxy bypass, server-action issues, cache confusion, image optimizer). `next` and the matching `@next/*` packages are pinned to `16.3.8`. After the pin and the overrides below, production audit reports **0 critical**.

Other patched transitive packages (override, already the project’s style): `form-data` 4.0.6, `axios` ^1.20.0, `postcss` ^8.5.31, `hono` ^4.13.13, `tar` ^7.5.22, `undici` ^6.29.1, `proxy-addr` ^2.0.8, `websocket-driver` ^0.7.5, `protobufjs` ^7.6.6, `@fastify/busboy` ^3.2.3, `http-cache-semantics` ^4.3.0, `ip-address` ^10.7.4.

### Left on purpose

Production `npm audit --omit=dev` still reports **3 high** and **7 moderate**:

- `@grpc/grpc-js` — firebase client and firebase-admin/google-gax pull different lines. One override would force the client onto the admin line.
- `brace-expansion` — majors 1, 2, and 5 are all in the tree; a single override cannot satisfy every parent.
- `js-yaml` — `gray-matter` uses 3.14.2 while other packages use 4.x. A blanket override would downgrade the 4.x copies.

These are advisory hits in dependencies, not a confirmed request path that exploits them. `npm audit fix --force` was not used.

Firestore rule edits in this change are source until they are deployed. The GitHub "Deploy Firestore rules + indexes" workflow has been failing with a 403 since May 2026, so a maintainer still needs `firebase deploy --only firestore:rules,firestore:indexes` (or a fixed workflow) before the owner-only user read and the `emailLookup` deny are live. The directory API sanitizer takes effect on the next app deploy and does not wait for that rules deploy.

Pair, mentorship, and session display names now come from the public members snapshot (rebuilt on a cron). A brand-new public profile can show a blank name until the next snapshot. Emails stop appearing on the directory response immediately, including for a snapshot that was stored before this change.

### Checked and not confirmed

- No live secret in the tree or in git history. Hits for private-key blocks, `sk_live_`, and `AIza` are prompt text, logger tests, or redaction code. Demo env files use placeholder values. Nothing here needs a rotation based on this audit.
- No Supabase project and no service-role key. Firebase web config is public by design.
- No Stripe webhook. The GitHub webhook checks HMAC-SHA256 with a timing-safe compare and rejects a missing secret.
- OAuth return paths must start with `/` and must not start with `//`.
- `dangerouslySetInnerHTML` uses are JSON-LD built with `JSON.stringify`, not raw member HTML.
- `POST /api/auth/resolve-email` can tell whether an email has an account. It is already rate-limited and was left as-is.
- Content-Security-Policy still allows `'unsafe-inline'` scripts. No XSS sink was shown that turns that into a confirmed issue.
- Login and signup go through the Firebase client SDK. The app’s send-verification route is authenticated and rate-limited. There is no separate app login route to wrap.

Thank you for helping keep Cursor Boston secure!
