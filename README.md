# CV Tracker Extension

A Chrome and Edge (Manifest V3) extension that analyzes job offers with your own LLM API key and tracks your applications locally in the browser.

> Status: early development. The extension shell, tooling and CI are in place; the analysis and tracking features are being built and are not yet usable.

## Install

The extension is installed unpacked. A signed store listing is not planned.

### From a release zip

1. Download the zip for your browser from the latest release and extract it to a stable folder. Do not delete or move the folder afterwards.
2. Chrome: open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select the extracted folder.
3. Edge: open `edge://extensions`, enable Developer mode, choose Load unpacked, and select the extracted folder.
4. To update, extract the new zip over the same folder and reload the extension. The extension ID stays the same because the manifest pins a public key.

### From source

Requires Node 22.18 or newer (`.nvmrc` pins the version used in CI) and pnpm.

```sh
pnpm install
pnpm build
```

Then load `.output/chrome-mv3` with Load unpacked as described above.

## First run

First-run steps (choosing a provider, entering your API key, and the terms-of-service acknowledgement) will be documented here when the onboarding flow lands.

## What is stored locally

Placeholder. This section will list every local data category when the corresponding features land. The complete statement lives in [PRIVACY.md](PRIVACY.md).

## What leaves the browser

Placeholder. This section will state which party receives what and when. The complete statement lives in [PRIVACY.md](PRIVACY.md).

## API key storage

Your API key is stored unencrypted in the extension's local storage on your device. Anyone with access to your browser profile can read it. See [SECURITY.md](SECURITY.md).

## No telemetry

The extension contains no analytics, crash reporting or tracking of any kind, and CI fails if a telemetry package is added.

## Portal terms of service risk

Reading job portal pages with the help of this extension may conflict with a portal's terms of service. You are responsible for how you use it. Portal reading only happens on pages you open or on scans you explicitly enable, and details about acknowledging this risk will be documented with the feature.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). The architecture overview is in [docs/architecture.md](docs/architecture.md). Licensed under the [MIT License](LICENSE).
