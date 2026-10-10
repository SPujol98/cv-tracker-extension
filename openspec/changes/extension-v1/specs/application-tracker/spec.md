# Application Tracker Specification

## Purpose

Defines the local application tracker: persisted offer and analysis records, the status workflow, listing/search/notes, and schema versioning of the local database. Data lives in IndexedDB; settings and the API key live in `chrome.storage.local`. Import/export is covered by `data-portability`.

## Requirements

### Requirement: TRACKER-1 Offer and analysis record

A tracker record MUST be unique per (source, id) and MUST contain: the offer snapshot (title, company, location, canonical URL, source, id, offer text), the latest analysis result (ANALYSIS-10) or none for imported records and for beacon records flagged as failed (amendment A14), matched/recommended branch name as text, status, notes, origin (`manual`, `beacon`, `import`), the producing adapter version when known, and timestamps `createdAt`, `updatedAt`, `statusChangedAt`. Writes MUST be atomic: a failed write leaves no partial record.

#### Scenario: Create from analysis

- GIVEN a completed analysis for a LinkedIn offer
- WHEN it is saved
- THEN one record exists keyed by (`linkedin`, id) with offer snapshot, analysis, status `new`, origin `manual`

#### Scenario: Uniqueness

- GIVEN a record for (`linkedin`, 123)
- WHEN another save for the same key occurs
- THEN the existing record is updated and the total count is unchanged

#### Scenario: Failed beacon record has no analysis (amendment A14)

- GIVEN a beacon offer whose analysis permanently failed
- WHEN its record is saved as flagged failed
- THEN one record exists keyed by (source, id) with the offer snapshot, origin `beacon`, and no analysis result

#### Scenario: Atomic failure

- GIVEN storage raises a quota error during a save
- WHEN the save fails
- THEN no record for that key was created or modified
- AND the user sees a storage-full message

### Requirement: TRACKER-2 Status workflow (confirmed by owner 2026-10-10: Q8)

Status MUST be one of eight English enum values: `new`, `to_apply`, `applied`, `screening`, `interview`, `offer`, `rejected`, `discarded`. Each has i18n labels (SHELL-8). Records created by saving an analysis or by a scan start as `new`. The user MAY change a record to any other status (assumption: transitions are unrestricted); each change MUST update `statusChangedAt`, `updatedAt`, and append an entry (previous status, new status, timestamp) to the record's status history. Setting the current status again MUST be a no-op.

#### Scenario: Change status

- GIVEN a record in `new`
- WHEN the user sets `applied`
- THEN status is `applied`, `statusChangedAt` is updated, and the history has one entry `new → applied`

#### Scenario: Same status no-op

- GIVEN a record in `applied`
- WHEN the user sets `applied`
- THEN the history length and timestamps are unchanged

#### Scenario: Backward move allowed

- GIVEN a record in `interview`
- WHEN the user sets `to_apply`
- THEN the change is accepted and recorded

#### Scenario: Labels

- GIVEN UI language Spanish
- WHEN the status control renders
- THEN each enum value shows its Spanish label

### Requirement: TRACKER-3 List, filter, sort and search

The tracker list MUST support filtering by status, verdict, source, branch name, and origin; sorting by score, `createdAt`, `updatedAt`, and `statusChangedAt` in both directions; and text search over title, company, and notes that is case-insensitive and accent-insensitive. The list MUST be paginated (assumption: 50 per page) and MUST remain correct with at least 5,000 records.

#### Scenario: Combined filter

- GIVEN records with mixed statuses and verdicts
- WHEN the user filters status `applied` and verdict `apply`
- THEN only records matching both are listed

#### Scenario: Accent-insensitive search

- GIVEN a record titled "Ingeniería de Software"
- WHEN the user searches "INGENIERIA"
- THEN the record is listed

#### Scenario: Search in notes

- GIVEN a record whose notes contain "recruiter called"
- WHEN the user searches "RECRUITER"
- THEN the record is listed

#### Scenario: Sorting

- GIVEN records with scores 90, 40, 70
- WHEN sorted by score descending
- THEN the order is 90, 70, 40

#### Scenario: Pagination at scale

- GIVEN 5,000 records
- WHEN page 3 of size 50 is requested
- THEN exactly 50 records (positions 101 to 150 of the sorted result) are returned

### Requirement: TRACKER-4 Notes and deletion

The user MUST be able to edit free-text notes on a record; edits persist and update `updatedAt`. Deleting a record MUST require confirmation and MUST remove only that record; the offer's id MUST remain in the beacon seen set (BEACON-4). Notes MUST be treated as untrusted text for rendering (PRIV-4).

#### Scenario: Notes persist

- GIVEN a record
- WHEN the user saves notes "call Tuesday" and reloads the options page
- THEN the notes read "call Tuesday"

#### Scenario: Delete requires confirmation

- GIVEN the user presses Delete
- WHEN the confirmation is dismissed
- THEN the record still exists

#### Scenario: Notes with markup

- GIVEN notes `<b>bold</b>`
- WHEN displayed
- THEN the text appears literally and no bold element is created

### Requirement: TRACKER-5 Status summary

The popup MUST show the number of records per status and the count of new analyzed results not yet viewed (BEACON-9).

#### Scenario: Summary counts

- GIVEN 2 `new`, 1 `applied`, 0 others
- WHEN the popup renders
- THEN it shows `new: 2`, `applied: 1`, and zero for the other statuses

### Requirement: TRACKER-6 Database schema versioning and forward-only migrations

The local database MUST have an explicit integer schema version. Opening a database created by an older schema MUST migrate it forward preserving all records. Migrations MUST be forward-only and covered by tests that open a fixture database of every prior version. If the stored schema version is newer than the running extension, the extension MUST NOT modify the data and MUST show a message instructing the user to install a newer version or restore from a backup taken before the upgrade.

#### Scenario: Forward migration preserves data

- GIVEN a fixture database at schema N-1 with 10 records
- WHEN the extension opens it at schema N
- THEN all 10 records are present with the new fields defaulted

#### Scenario: Downgrade refused

- GIVEN a database at schema N+1 and an extension at schema N
- WHEN the extension opens it
- THEN no write is performed
- AND the options page shows the downgrade message with a link to restore instructions

#### Scenario: Fresh install

- GIVEN no database
- WHEN the extension opens
- THEN the database is created at the current schema version
