# Security Policy

## Supported versions

Only the latest released version receives security fixes. The project is in early development and has no stable release yet.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting: open the repository's Security tab and choose "Report a vulnerability" to create a private security advisory. Do not open a public issue for a vulnerability and do not post details publicly before a fix is available.

Include the affected version, the steps to reproduce, and the impact you observed. You can expect an acknowledgement and an assessment through the advisory thread.

## Threat model notes

- **API key.** The LLM API key is stored unencrypted in the extension's local storage. This is a deliberate trade-off to keep the extension simple and fully local. The key is only readable from trusted extension contexts, is never sent to content scripts, and the UI will warn about this when key entry is introduced. Anyone with access to the browser profile can read it, so use a key with a spending limit.
- **Prompt injection.** Text from job offers is untrusted. It is treated as data, the model has no tools, and outputs are validated and rendered as text. A crafted offer can still influence the wording or score of an analysis. This residual risk is bounded, not eliminated, so review results before acting on them.
