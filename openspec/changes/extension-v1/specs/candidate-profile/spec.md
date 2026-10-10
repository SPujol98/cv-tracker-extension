# Candidate Profile Specification

## Purpose

Defines how a user builds the profile that analysis scores against: onboarding from pasted CV text with LLM-proposed claims and tags reviewed by the user, user-defined branches with their own title filters, rules and dealbreakers, base CV PDFs per branch and language, and a profile version used in cache keys. The product ships with no personal or default content.

## Requirements

### Requirement: PROFILE-1 Empty-by-default profile

A fresh install MUST contain no claims, no branches, no title-filter terms, no company blocklist entries, no dealbreakers, and no PDFs. No term list of any kind MAY ship in the product.

#### Scenario: Fresh install is empty

- GIVEN a fresh install
- WHEN the profile store is read
- THEN all claim, branch, filter, blocklist, dealbreaker and PDF collections are empty

### Requirement: PROFILE-2 CV-text onboarding with explicit disclosure (confirmed by owner 2026-10-10: Q1)

Onboarding MUST accept CV text pasted by the user. Before the text is sent to the provider, the UI MUST state which provider and model will receive it and MUST require an explicit user action to proceed. Uploaded PDFs MUST NOT be sent to any provider. The LLM MUST return proposed claims (statement and tags) in a schema-validated structure. Nothing proposed MUST be stored as accepted until the user reviews it. Onboarding calls count toward metering and the daily budget (LLM-8, LLM-9).

#### Scenario: Disclosure before send

- GIVEN pasted CV text and a configured provider
- WHEN the user opens the "propose claims" step
- THEN the provider and model names are shown
- AND no request is sent until the user confirms

#### Scenario: Proposed claims are not yet accepted

- GIVEN the provider returned 12 proposed claims
- WHEN the review screen is displayed
- THEN the persisted accepted-claims collection is still empty

#### Scenario: Provider failure during onboarding

- GIVEN the call fails with `rate_limit` after retries
- WHEN the failure is shown
- THEN the user can retry or continue by adding claims manually
- AND the pasted text is still present in the form

#### Scenario: Budget blocks onboarding

- GIVEN the daily budget is reached
- WHEN the user confirms "propose claims"
- THEN the user sees the budget message and manual claim entry remains available

### Requirement: PROFILE-3 Claim review and management

The user MUST be able to accept, edit, delete, and manually add claims, each with a statement and a set of tags. Each claim MUST have a stable id that is never reused after deletion. A claim MUST NOT be saved with an empty statement. Review MUST be completable entirely through the UI.

#### Scenario: Accept and edit

- GIVEN three proposed claims
- WHEN the user accepts two and edits the statement of one
- THEN the stored claims are those two with the edited text for the edited one

#### Scenario: Id never reused

- GIVEN a claim with id `c-7` is deleted
- WHEN a new claim is added
- THEN the new claim's id is not `c-7`

#### Scenario: Empty statement rejected

- GIVEN the claim editor
- WHEN the user saves a claim whose statement is blank
- THEN the save is refused with a validation message

### Requirement: PROFILE-4 User-defined branches (confirmed by owner 2026-10-10: Q2)

The user MUST be able to create, rename, and delete branches without a fixed limit. A branch has a name, title filters (include groups and exclude terms, see BEACON-3), free-text rules, and dealbreakers. A new branch MUST start with empty filters, rules, and dealbreakers. Deleting a branch MUST require confirmation and MUST also remove its PDFs; existing tracker records MUST keep their stored branch name as text.

#### Scenario: New branch is empty

- GIVEN the user creates branch "Backend"
- WHEN it is read back
- THEN it has zero include groups, zero exclude terms, no rules, and no dealbreakers

#### Scenario: Delete cascades to PDFs only

- GIVEN a branch with two PDFs and three tracker records referencing it
- WHEN the branch is deleted after confirmation
- THEN its PDFs are removed
- AND the three tracker records still display the branch name

### Requirement: PROFILE-5 Supported languages (confirmed by owner 2026-10-10: Q2)

Offer and CV languages supported in v1 MUST be Spanish, English, and Catalan. The set MUST be driven by an extensible language table so adding a language needs no change to consuming code.

#### Scenario: Language options

- GIVEN the PDF upload form
- WHEN the language selector is read
- THEN it offers exactly `es`, `en`, `ca`

### Requirement: PROFILE-6 Base CV PDFs per branch and language

The user MUST be able to attach at most one PDF per (branch, language) pair, replace it, and delete it. The upload MUST verify the file is a PDF by content signature, not only by extension, and MUST reject other files. Each PDF MUST be stored as a binary object in IndexedDB together with its filename, size, and SHA-256. The system MUST allow opening or downloading a stored PDF and MUST NEVER upload, attach, or submit a PDF to any site automatically.

#### Scenario: Valid PDF stored

- GIVEN a file starting with the `%PDF-` signature
- WHEN the user attaches it to (Backend, en)
- THEN it is stored with filename, size and SHA-256
- AND the SHA-256 equals the digest of the file bytes

#### Scenario: Non-PDF rejected

- GIVEN a text file renamed `cv.pdf`
- WHEN the user attaches it
- THEN the upload is rejected with a message

#### Scenario: Replace

- GIVEN (Backend, en) already has a PDF
- WHEN the user attaches another file to the same pair
- THEN exactly one PDF remains for the pair, the new one

#### Scenario: Storage failure leaves no partial record

- GIVEN storage raises a quota error during PDF save
- WHEN the save fails
- THEN no PDF record or metadata exists for the pair
- AND the user sees a storage-full message

#### Scenario: No automatic upload

- GIVEN a recommended PDF on a review card
- WHEN the user views a portal application page
- THEN the extension performs no file attachment or form interaction on that page

### Requirement: PROFILE-7 Profile completeness

A profile MUST be considered complete when it has at least one accepted claim, at least one branch, and a stored provider key that is not marked invalid (valid or unverified, LLM-6) (amendment A8). (Previously: a validated provider key.) Analysis entry points MUST NOT call the provider while the profile is incomplete; they MUST instead guide the user to the missing step.

#### Scenario: Incomplete profile

- GIVEN a configured key and no claims
- WHEN the user starts an analysis
- THEN no provider request is sent
- AND the UI links to the claim step in the options page

#### Scenario: Unverified key keeps the profile complete (amendment A8)

- GIVEN a stored key whose validation was `unverifiable`, at least one accepted claim, and one branch
- WHEN profile completeness is evaluated
- THEN the profile is complete

#### Scenario: Invalid key makes the profile incomplete (amendment A8)

- GIVEN a stored key marked invalid, at least one accepted claim, and one branch
- WHEN the user starts an analysis
- THEN no provider request is sent
- AND the UI links to the key settings

#### Scenario: Fresh user completes onboarding without editing files

- GIVEN a fresh install
- WHEN the user enters a key, pastes CV text, accepts claims, and creates one branch
- THEN the profile is complete
- AND no JSON or file editing was required

### Requirement: PROFILE-8 Profile version for cache keys

The profile MUST carry a version value that changes whenever any input included in analysis prompts changes: claims (statement, tags, set membership), branch names, branch rules, branch dealbreakers, and the rationale output language (ANALYSIS-10; amendment A4). It MUST NOT change when PDFs, title filters, or unrelated settings change. The version MUST be deterministic for identical content.

#### Scenario: Claim edit bumps version

- GIVEN profile version V1
- WHEN a claim statement is edited
- THEN the version differs from V1

#### Scenario: PDF change keeps version

- GIVEN profile version V1
- WHEN a PDF is replaced
- THEN the version is still V1

#### Scenario: Deterministic

- GIVEN two profiles with identical claims, branch names, rules and dealbreakers built in different orders of insertion
- WHEN their versions are computed
- THEN they are equal
