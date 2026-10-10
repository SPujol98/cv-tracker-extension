# LLM Providers Specification

## Purpose

Defines the provider adapter boundary, the Anthropic and OpenAI implementations, structured output and streaming, user-owned API key handling, per-call token/cost metering, and the daily budget hard stop. All calls use the user's own key and originate only from the service worker. Anthropic and OpenAI are the v1 providers (owner decision D5); others are post-v1.

## Requirements

### Requirement: LLM-1 Provider adapter contract

Every provider MUST be implemented as an adapter exposing: a stable provider id, a display name, a list of selectable models each with a price entry, a key-validation operation, and a structured-completion operation that accepts a prompt split into a stable prefix and a variable part plus a JSON schema, and returns streamed events followed by one final result `{ json, usage, model }`. Calling code MUST depend only on this contract. A shared contract test suite MUST run unchanged against the Anthropic adapter, the OpenAI adapter, and a fake adapter.

#### Scenario: Fake adapter drives the pipeline

- GIVEN a fake adapter registered in the provider registry
- WHEN the analysis pipeline requests a completion
- THEN the pipeline works without any provider-specific code path

#### Scenario: Contract suite rejects a non-conforming adapter

- GIVEN an adapter whose final result omits `usage`
- WHEN the contract suite runs
- THEN it fails naming the missing field

### Requirement: LLM-2 Anthropic adapter

The Anthropic adapter MUST call the Messages API with JSON-schema structured output and streaming, authenticating with the user's key. It MUST include every header Anthropic requires for browser-origin calls, including `anthropic-dangerous-direct-browser-access` if Spike S1 confirms it is still required from an extension origin. It MUST NOT declare any tools. The schema sent MUST contain only keywords supported by Anthropic structured outputs (no length or numeric bounds, no recursion).

#### Scenario: Request shape against a recorded fixture

- GIVEN a recorded Anthropic streaming fixture
- WHEN the adapter completes a request against a mocked transport
- THEN the outgoing request carries the key header, the version header, a JSON-schema output format, and `stream: true`
- AND declares no tools

#### Scenario: Stream assembled into the final result

- GIVEN a fixture streamed in several chunks
- WHEN the adapter consumes the stream
- THEN the final `json` equals the fixture's full JSON
- AND `usage` has input and output token counts

#### Scenario: Unsupported schema keyword

- GIVEN a schema containing `minLength`
- WHEN the adapter prepares the request
- THEN the contract test for schema compatibility fails

### Requirement: LLM-3 OpenAI adapter

The OpenAI adapter MUST call the OpenAI API with strict JSON-schema structured output (all properties required, no additional properties) and streaming, authenticating with the user's key, and MUST NOT declare any tools.

#### Scenario: Strict schema enforced

- GIVEN a schema with an optional property
- WHEN the adapter prepares the request
- THEN the outgoing schema marks every property required
- AND sets additional properties to disallowed

#### Scenario: Stream assembled into the final result

- GIVEN a recorded OpenAI streaming fixture
- WHEN the adapter consumes the stream
- THEN the final `json` and `usage` match the fixture expectations

### Requirement: LLM-4 Service-worker-only calls, streaming and timeouts

Provider requests MUST be issued only from the service worker, never from content scripts or injected page code. Responses MUST be consumed as streams. A call MUST fail with a `timeout` error if no chunk arrives within an inactivity limit of 60 seconds (assumption) or if total duration exceeds 240 seconds (assumption). The user MUST be able to cancel an in-flight call, which MUST abort the request and record no analysis result.

#### Scenario: Inactivity timeout

- GIVEN a mocked stream that stops emitting after the first chunk
- WHEN 60 seconds elapse on a fake clock
- THEN the call ends with error class `timeout`

#### Scenario: User cancels

- GIVEN a call is streaming
- WHEN the user cancels
- THEN the underlying request is aborted
- AND the result is class `cancelled` and nothing is cached or saved

#### Scenario: No provider request from page context

- GIVEN a scan or manual analysis reads a portal page
- WHEN the injected reading code is inspected
- THEN it contains no provider endpoint and no key access

### Requirement: LLM-5 Error classification and bounded retry

Failures MUST be classified into exactly: `auth`, `permission_missing`, `rate_limit`, `transient` (network or 5xx), `invalid_request`, `refusal`, `invalid_output`, `timeout`, `cancelled`, `budget_exceeded`. Adapters MUST retry only `transient` and `rate_limit` errors, at most 2 retries with exponential backoff, honoring a `Retry-After` value when present. `auth` MUST NOT be retried. Error messages shown or logged MUST NOT contain the key.

#### Scenario: Status mapping

- GIVEN mocked responses with status 401, 429, 503
- WHEN each is processed
- THEN they map to `auth`, `rate_limit`, `transient` respectively

#### Scenario: Retry bound

- GIVEN a mocked endpoint that always returns 503
- WHEN a call is made
- THEN exactly 3 requests are sent (1 initial + 2 retries)
- AND the final error is `transient`

#### Scenario: Auth not retried

- GIVEN a mocked 401
- WHEN a call is made
- THEN exactly 1 request is sent

#### Scenario: Retry-After honored

- GIVEN a 429 with `Retry-After: 7`
- WHEN the adapter retries
- THEN it waits at least 7 seconds on the fake clock before the next request

### Requirement: LLM-6 API key entry, validation and local storage

The key MUST be entered in the settings page, stored only in `chrome.storage.local`, and displayed masked. The entry screen MUST display a warning that the key is stored unencrypted in the browser profile and MUST advise using a dedicated, spend-limited key. Key validation MUST perform a minimal authenticated request to the selected provider and report `valid`, `invalid`, or `unverifiable`. (amendment A7) `unverifiable` covers network failures, rate limiting or provider unavailability, and authorization responses that do not prove the key invalid (for example HTTP 403 from a restricted key that lacks model-listing scope). Only an authentication rejection (HTTP 401) is `invalid`. The user MAY save a key whose validation is `unverifiable`; it is stored as unverified and is usable. The first successful provider call marks it valid; an `auth` failure marks it invalid. A failed validation MUST NOT erase a previously stored key. The user MUST be able to remove the key, which deletes it from storage. The key MUST NOT be stored in IndexedDB, MUST NOT be written to logs, error text, or URLs, and MUST be sent only to the selected provider's host.

#### Scenario: Warning visible at entry

- GIVEN the key field is rendered
- WHEN the settings page is inspected
- THEN the unencrypted-storage warning and the spend-limit advice are present adjacent to the field

#### Scenario: Validation outcomes

- GIVEN mocked provider responses 200, 401, 403, and a network failure
- WHEN validation runs for each
- THEN the results are `valid`, `invalid`, `unverifiable`, `unverifiable` (amendment A7)

#### Scenario: Unverified key promoted by a successful call (amendment A7)

- GIVEN a key saved as unverified
- WHEN an analysis succeeds
- THEN the key status becomes valid

#### Scenario: Invalid new key keeps the old key

- GIVEN a valid key is stored
- WHEN the user enters a new key that validates as `invalid`
- THEN the stored key is still the previous key

#### Scenario: Key removal

- GIVEN a stored key
- WHEN the user removes it
- THEN `chrome.storage.local` no longer contains it
- AND further provider calls fail with `auth` before any network request

#### Scenario: Key confined to provider host

- GIVEN a full manual analysis flow in the smoke environment
- WHEN every outgoing request is recorded
- THEN the key value appears only in requests to the selected provider host

### Requirement: LLM-7 Provider host permission

Before the first request to a provider, the extension MUST hold the optional host permission for that provider's origin. If it is not granted, the call MUST fail with `permission_missing` without a network request.

#### Scenario: Missing permission

- GIVEN a configured key and no granted provider permission
- WHEN a completion is requested
- THEN the error is `permission_missing` and no request is sent

### Requirement: LLM-8 Token and cost metering

For every provider call (analysis, onboarding, validation) the system MUST record provider, model, input tokens, output tokens, cached input tokens when reported, computed cost in USD, timestamp, and purpose. Cost MUST be computed from a versioned per-model price table. Only models present in the price table MUST be selectable, so cost is always defined (assumption: custom model ids are out of v1). If a provider omits usage, token counts MUST be estimated and flagged `estimated`. The cost of an analysis MUST be available to the UI. (amendment A6) Before a token-consuming request is sent, a usage record with estimated tokens MUST be written; it MUST be reconciled with reported usage when the call completes. A call interrupted by cancellation, timeout, a mid-stream failure, or service-worker termination MUST keep an estimated record (flagged `estimated`) that counts toward the daily total. A call MUST never produce more than one usage record.

#### Scenario: Cost computed from usage

- GIVEN a price of $1 per million input tokens and $5 per million output tokens for a model
- WHEN a call reports 10,000 input and 2,000 output tokens
- THEN the recorded cost is $0.02

#### Scenario: Missing usage estimated

- GIVEN a provider stream with no usage event
- WHEN the call completes
- THEN the record has `estimated: true` and non-zero token counts

#### Scenario: Unlisted model not selectable

- GIVEN a model id absent from the price table
- WHEN the model list for the settings page is built
- THEN that model is not offered

#### Scenario: Interrupted call keeps an estimated record (amendment A6)

- GIVEN a call streaming output
- WHEN the service worker is terminated and restarted
- THEN the day's recorded cost includes an estimated record for that call
- AND that call has exactly one usage record

### Requirement: LLM-9 Daily budget hard stop

A daily spending limit in USD MUST exist and be enabled by default with a conservative default value (assumption: 1.00 USD). The day MUST be the local calendar day. Before every provider call that can consume tokens (analysis, onboarding), if the day's recorded cost is greater than or equal to the limit, the call MUST fail with `budget_exceeded` and send no request. Key validation (LLM-6), a zero-token metadata request, is exempt and is still recorded with zero cost (LLM-8). (amendment A5) A call already in flight when the limit is crossed MUST complete and be recorded. Raising the limit MUST take effect immediately. The limit MUST apply equally to manual analysis, onboarding, and scans.

#### Scenario: Limit reached

- GIVEN a limit of 0.50 USD and 0.50 USD already spent today
- WHEN any provider call is requested
- THEN the result is `budget_exceeded` and no request is sent

#### Scenario: Day rollover

- GIVEN the limit was reached yesterday
- WHEN the local date changes and a call is requested
- THEN the call proceeds

#### Scenario: Raising the limit

- GIVEN `budget_exceeded` today
- WHEN the user raises the limit above today's spend
- THEN the next call proceeds

#### Scenario: In-flight call completes

- GIVEN spend is 0.49 of a 0.50 limit and a call is in flight costing 0.05
- WHEN the call finishes
- THEN its result is returned and recorded
- AND the next call returns `budget_exceeded`

### Requirement: LLM-10 Provider and model selection

Exactly one provider and one model MUST be active at a time, chosen in settings from the adapters' lists, each adapter defaulting to its cheapest suitable listed model. Changing the active model MUST NOT modify stored profile data.

#### Scenario: Default model

- GIVEN a fresh install where the user selects OpenAI
- WHEN settings are read
- THEN the active model is the adapter's declared default model

#### Scenario: Switching provider keeps the profile

- GIVEN a populated profile
- WHEN the user switches from Anthropic to OpenAI
- THEN the profile records are unchanged
