# Data Portability Specification

## Purpose

Defines how users get data out of and into the extension: CSV and JSON export of the tracker, a full backup/restore of everything the user owns, a generic CSV history importer, and backup reminders. All files are produced and consumed locally in the browser; nothing is uploaded. XLSX and folder sync are out of scope for v1 (confirmed by owner 2026-10-10: Q5), so Spike S4 is recorded as N/A unless Q5 changes.

## Requirements

### Requirement: PORT-1 CSV export of the tracker (confirmed by owner 2026-10-10: Q5)

The user MUST be able to export the tracker (all records, or the currently filtered set) as CSV with a fixed, documented column order including at least: source, id, canonical URL, title, company, location, status, verdict, score, branch, offer language, origin, createdAt, updatedAt, statusChangedAt, notes. The file MUST be UTF-8 with a byte-order mark for spreadsheet compatibility (assumption). Fields containing commas, quotes, or newlines MUST be quoted and escaped per RFC 4180. Any cell beginning with `=`, `+`, `-`, or `@` MUST be neutralized so spreadsheets do not execute it as a formula.

#### Scenario: Escaping

- GIVEN a note `He said "call me", then\nleft`
- WHEN exported
- THEN the cell is a single quoted field with doubled inner quotes and the newline preserved

#### Scenario: Formula neutralization

- GIVEN a title `=HYPERLINK("http://x","y")`
- WHEN exported
- THEN the cell value begins with a neutralizing prefix and does not begin with `=`

#### Scenario: Filtered export

- GIVEN 100 records and a filter showing 12
- WHEN the user chooses "export current view"
- THEN the file has a header plus 12 rows

#### Scenario: Header and BOM

- GIVEN any export
- WHEN the file bytes are read
- THEN they start with the UTF-8 BOM followed by the documented header row

### Requirement: PORT-2 JSON export of the tracker

The user MUST be able to export tracker records as JSON that includes a format identifier, a format version, and the export timestamp, and that validates against the same schema used to read it back. Offer text MAY be included; the API key MUST NOT be.

#### Scenario: Re-importable

- GIVEN a JSON tracker export
- WHEN it is validated by the import schema
- THEN validation passes

#### Scenario: No secrets

- GIVEN a configured API key
- WHEN a JSON export is produced
- THEN the key value appears nowhere in the file

### Requirement: PORT-3 Full backup export

The user MUST be able to export a single backup file containing: profile (claims, branches, filters, rules, dealbreakers), base CV PDFs with SHA-256 digests, tracker records, saved searches, seen-id sets, and settings. Derived or transient data (analysis cache, queue, wall/backoff state, usage meter history beyond the current day) MUST be excluded. The API key MUST be excluded by default; including it MUST require an explicit opt-in action accompanied by a warning that the file then contains a secret. The file MUST carry a format version and the extension version. The default filename MUST include the date and time. (amendment A9) The settings in the backup MUST exclude consent and runtime state: the terms-of-service acceptance, the scheduled-scanning switch, key validation status, and update-check state.

#### Scenario: Key excluded by default

- GIVEN a stored key
- WHEN a default backup is exported
- THEN the file does not contain the key

#### Scenario: Key opt-in

- GIVEN the user checks "include API key" after reading the warning
- WHEN the backup is exported
- THEN the file contains the key and the UI had displayed the warning

#### Scenario: Contents

- GIVEN a populated profile, 2 PDFs and 3 tracker records
- WHEN a backup is exported
- THEN the file lists the claims, branches, both PDFs with digests, and the 3 records

#### Scenario: Excluded data

- GIVEN a populated analysis cache and queue
- WHEN a backup is exported
- THEN neither appears in the file

#### Scenario: Consent and runtime state excluded (amendment A9)

- GIVEN terms accepted, scheduled scanning on, a key validated, and the update check enabled
- WHEN a backup is exported
- THEN the file contains none of the terms acceptance, the scheduled-scanning switch, the key validation status, or the update-check state

### Requirement: PORT-4 Backup import, replace semantics and atomicity

Importing a backup MUST first validate the entire file (schema, format version, and every PDF digest) before modifying any stored data. A file with a newer format version than supported MUST be rejected with a message. An older format version MUST be migrated forward. Import MUST replace existing data and MUST require explicit confirmation when existing data is present. The import MUST be all-or-nothing: on any failure the pre-import state remains intact. (amendment A9) Import MUST leave the terms acceptance absent, scheduled scanning off, the update check off, and a restored key unverified. Import MUST stop queued and running background work before writing and resume it afterwards.

#### Scenario: Round trip

- GIVEN a populated profile, PDFs, tracker, saved searches, seen ids and settings
- WHEN a backup is exported, all data is wiped, and the backup is imported
- THEN every restored collection is deeply equal to the original (excluding the key unless opted in)
- AND settings are compared excluding the consent and runtime-state fields (amendment A9)

#### Scenario: Consent not restored by import (amendment A9)

- GIVEN a backup exported with scanning scheduled and terms accepted
- WHEN imported on another browser
- THEN scheduled scanning is off
- AND the terms screen is required before any scan

#### Scenario: Restored key is unverified (amendment A9)

- GIVEN a backup that includes the key by opt-in
- WHEN imported
- THEN the key is restored with status unverified

#### Scenario: Background work quiesced during import (amendment A9)

- GIVEN queued background work and an import in progress
- WHEN the import writes data
- THEN no queued or running job executes until the import finishes
- AND background work resumes afterwards

#### Scenario: Corrupted PDF digest

- GIVEN a backup whose PDF bytes do not match their digest
- WHEN imported
- THEN the import is rejected and existing data is unchanged

#### Scenario: Newer format

- GIVEN a backup with format version greater than supported
- WHEN imported
- THEN it is rejected with a message to update the extension

#### Scenario: Replace needs confirmation

- GIVEN existing data
- WHEN the user selects a valid backup file
- THEN a confirmation naming what will be replaced is shown
- AND nothing changes until confirmed

#### Scenario: Failure mid-import

- GIVEN a storage error occurs while writing the third collection
- WHEN the import aborts
- THEN all collections equal their pre-import content

### Requirement: PORT-5 Generic CSV history importer

The user MUST be able to import application history from a CSV file with a column-mapping step. Supported mappable fields: title, company, URL, status, location, date applied, notes. The importer MUST auto-detect the delimiter among comma and semicolon, handle quoted fields containing delimiters and newlines, and accept UTF-8 with or without BOM. The status mapping step MUST map each distinct source value to one of the eight tracker statuses (TRACKER-2); unmapped values MUST be resolved by the user before import. A preview MUST show row counts and row-level errors with line numbers. Rows with a recognized portal URL MUST be keyed by (source, id); other rows MUST be keyed by a hash of normalized title, company and date. Existing records MUST NOT be overwritten: duplicates are skipped and counted. Imported records MUST have origin `import`. A reusable mapping MAY be saved locally.

#### Scenario: Semicolon-delimited with quoted newline

- GIVEN a CSV using `;` with a quoted notes field containing a newline
- WHEN parsed
- THEN the row count equals the number of logical rows

#### Scenario: Status mapping required

- GIVEN a source file with status values "Enviada" and "Entrevista"
- WHEN the mapping step is shown
- THEN both values are listed and import is blocked until each maps to a tracker status

#### Scenario: Preview errors

- GIVEN row 7 has an empty title and company
- WHEN the preview is built
- THEN it reports an error for line 7 and counts it as skipped

#### Scenario: Duplicate skipped

- GIVEN the tracker has a record for (`linkedin`, 123)
- WHEN the CSV contains a row with the same offer URL
- THEN that row is skipped and the existing record is unchanged
- AND the summary reports 1 duplicate

#### Scenario: Origin marked

- GIVEN a successful import of 5 rows
- WHEN the new records are read
- THEN each has origin `import` and no analysis result

### Requirement: PORT-6 Backup reminders

The extension MUST remind the user to export a backup when data exists and the last backup export is older than 30 days (assumption) or never happened and records exist, and data has changed since. The reminder MUST appear in the options page and popup (not as a system notification), MUST appear at most once per day, and MUST be dismissible with a snooze. Exporting a backup MUST clear the reminder.

#### Scenario: Reminder after 31 days

- GIVEN a last backup 31 days ago and changes since
- WHEN the popup renders
- THEN the reminder is displayed

#### Scenario: No data no reminder

- GIVEN an empty profile and tracker
- WHEN the popup renders
- THEN no reminder is displayed

#### Scenario: Snooze

- GIVEN the user dismisses the reminder
- WHEN the popup is reopened the same day
- THEN the reminder is not shown again

### Requirement: PORT-7 Local-only file handling

All exports MUST be generated in the browser and saved through the browser's download mechanism. All imports MUST read files chosen by the user. No export or import MAY transmit file contents over the network.

#### Scenario: No network during export and import

- GIVEN the smoke environment records all network requests
- WHEN an export and an import are performed
- THEN no request is made for either operation
