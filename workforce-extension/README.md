# ShiftSync Quick Access — desktop Chrome companion

A deliberately small Manifest V3 extension that provides desktop shortcuts into
the existing ShiftSync web app. It is **not** required for the mobile PWA and is
not a second application.

## Security model

- **No permissions requested.** `permissions` and `host_permissions` are empty.
- **No content scripts, background worker or injected code.** The extension
  cannot read page content, `localStorage`, cookies or network traffic.
- **No credentials or tokens stored.** Every link opens the normal ShiftSync web
  app, where the existing JWT, MFA and role checks apply.
- **No business logic duplicated.** The extension only opens existing routes and
  `?section=` deep links. Unauthorised destinations fall back to the signed-in
  role's first permitted section, and the backend remains authoritative.
- **No remote code or third-party requests.** The popup is static HTML/CSS with
  local icons and inline SVG.
- **No incognito usage.** `incognito` is set to `not_allowed`.

The production URL is hard-coded to
`https://wfm.advancedvirtualsolutions.com/`. Change the links in `popup.html` if
the deployment hostname changes.

## Install (manual, desktop Chrome or Edge)

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `workforce-extension` directory.
5. Pin **ShiftSync Quick Access** to the toolbar and open the popup.

No build step is required.

## Package for approved distribution

Chrome Web Store and enterprise distribution expect a ZIP whose root contains
`manifest.json`. From the repository root:

```powershell
Compress-Archive -Path workforce-extension\manifest.json,workforce-extension\popup.html,workforce-extension\popup.css,workforce-extension\icons -DestinationPath workforce-extension\shiftsync-quick-access.zip -Force
```

The ZIP is ignored by Git. Do not upload private keys or `.pem` files.

## Compatibility and scope

- Desktop Chrome and Edge only. Chrome on iOS cannot install extensions; iPhone
  and iPad users should install the PWA to the Home Screen instead.
- Links to admin/hiring-manager areas are included for convenience. Access is
  still enforced by the web app and backend; the extension does not know or cache
  the signed-in role.
- Closing the popup and opening a link uses a normal browser tab, so password
  managers and the existing sign-in/MFA flow continue to work.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3, zero permissions, toolbar action |
| `popup.html` | Static quick links to existing web routes |
| `popup.css` | Popup-only styling; no external assets |
| `icons/` | 16/32/48/128 toolbar and extension icons |

## Verification

The manifest is static JSON; recommended checks before release:

- `permissions` and `host_permissions` remain empty.
- All `href` values use HTTPS and the production host.
- `popup.html` contains no `<script>` and no remote resources.
- Load unpacked in a clean Chrome profile and confirm the popup links open the
  web app, including after sign-out and role changes.
