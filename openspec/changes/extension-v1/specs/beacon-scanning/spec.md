# Beacon Scanning Specification

## Purpose

Defines saved searches ("beacons") and the optional scanning of them through the user's own logged-in portal session (owner decisions D1 and D2). Scanning opens search pages and the detail page of each new filtered offer in one reused browser tab, with rate-courtesy pacing (deliberately slow, randomized delays) (amendment A17), caps, and automatic stop on any wall. The schedule is OFF by default; a user-triggered "Scan now" is always possible. The title/company filter is a clean-room implementation of the owner's algorithm idea from this written behavior description, with no shipped term lists.

Default values marked "(assumption)" derive from the reference bot's conservative cadence and may be tuned in design without changing requirement intent.

## Requirements

### Requirement: BEACON-1 Saved searches

The user MUST be able to create, edit, enable/disable, and delete saved searches. A saved search has a name, a source (`linkedin` or `infojobs`), a search URL pasted by the user, and a set of branches whose filters apply (default: all branches). The URL MUST map to the chosen source's host and MUST pass the navigation guard (PORTAL-6); otherwise saving MUST be refused with a message. The number of enabled saved searches MUST be capped (assumption: 5).

#### Scenario: Valid beacon

- GIVEN a LinkedIn search URL and source `linkedin`
- WHEN the user saves the beacon
- THEN it is persisted enabled and appears in the list

#### Scenario: Forbidden URL form

- GIVEN a URL containing `runSearch`
- WHEN the user saves the beacon
- THEN saving is refused with a message

#### Scenario: Host mismatch

- GIVEN source `infojobs` and a LinkedIn URL
- WHEN the user saves
- THEN saving is refused

#### Scenario: Cap

- GIVEN 5 enabled beacons
- WHEN the user enables a sixth
- THEN the action is refused with a message about the cap

### Requirement: BEACON-2 Schedule off by default and Scan now

Scheduled scanning MUST be disabled on a fresh install and MUST register no scan alarm until enabled. Enabling the schedule MUST require the terms-of-service acknowledgement (PRIV-5) and the portal host permission (SHELL-1). A user-triggered "Scan now" MUST run the same scan flow on demand for one beacon or all enabled beacons without enabling the schedule; it MUST obey daily caps, wall backoff/pause, and the budget stop, and MAY ignore active hours and due times. Disabling the schedule MUST remove scan alarms and cancel queued scheduled items immediately.

#### Scenario: Fresh install

- GIVEN a fresh install
- WHEN settings are read
- THEN scheduled scanning is off and no scan alarm exists

#### Scenario: Enabling requires acknowledgement

- GIVEN the acknowledgement was never given
- WHEN the user tries to enable the schedule
- THEN the acknowledgement screen is shown and the schedule stays off until accepted

#### Scenario: Scan now without schedule

- GIVEN the schedule is off and the acknowledgement is given
- WHEN the user presses "Scan now"
- THEN one scan runs and the schedule remains off

#### Scenario: Scan now during pause

- GIVEN scanning is paused after repeated walls (BEACON-8)
- WHEN the user presses "Scan now"
- THEN no navigation occurs and the UI explains the pause with a resume control

#### Scenario: Disable cancels

- GIVEN the schedule is on with queued scheduled items
- WHEN the user disables it
- THEN alarms are removed and the queued scheduled items are cancelled

### Requirement: BEACON-3 Clean-room title and company filter

The filter MUST decide whether an offer's title and company pass a branch's filter configuration. Matching MUST be whole-word, case-insensitive, and accent-insensitive, so `java` does not match `javascript` and `ingenieria` matches `Ingeniería`. Terms containing symbols, such as `c#`, MUST match as literal tokens: `c#` matches "C# Developer" and does not match "C Developer". A branch's include configuration is a list of groups; a title passes include matching only if it matches at least one term of every group (groups combine with AND, terms within a group with OR). If there are no include groups, include matching passes. Any exclude term matching the title rejects the offer. A company matching any entry of the company blocklist rejects the offer. An offer passes the beacon if it passes at least one of the beacon's selected branches. No default terms or blocklist entries MAY exist in the product. Confirmation of authorship of the reference algorithm MUST be recorded per PRIV-10 before this requirement is implemented.

#### Scenario: Whole word

- GIVEN include group [`java`]
- WHEN titles "Java Developer" and "JavaScript Developer" are tested
- THEN the first passes and the second does not

#### Scenario: Accents and case

- GIVEN include group [`ingenieria`]
- WHEN the title "INGENIERÍA de Software" is tested
- THEN it passes

#### Scenario: Symbol term

- GIVEN include group [`c#`]
- WHEN "Senior C# Developer" and "Senior C Developer" are tested
- THEN the first passes and the second does not

#### Scenario: Groups are AND, terms are OR

- GIVEN include groups [`backend`, `back-end`] and [`senior`, `lead`]
- WHEN "Lead Back-end Engineer", "Backend Engineer", "Senior Designer" are tested
- THEN only the first passes

#### Scenario: Exclude wins

- GIVEN include group [`engineer`] and exclude [`intern`]
- WHEN "Engineer Intern" is tested
- THEN it is rejected

#### Scenario: Company blocklist

- GIVEN blocklist [`Acme Corp`]
- WHEN an offer from "ACME corp" is tested
- THEN it is rejected

#### Scenario: Empty configuration

- GIVEN a branch with no include groups, no exclude terms, no blocklist
- WHEN any title is tested
- THEN it passes
- AND the beacon UI shows a warning that every new offer will be analyzed and cost tokens

#### Scenario: Any selected branch

- GIVEN a beacon with branches A and B and an offer that fails A but passes B
- WHEN tested
- THEN the offer passes and records B as the matched branch

#### Scenario: No shipped lists

- GIVEN a fresh install
- WHEN all branch filter configurations and the blocklist are read
- THEN they are empty

### Requirement: BEACON-4 Seen ids and first-run baseline

The system MUST keep a per-source set of seen offer ids, capped at 3,000 entries with the oldest evicted first (assumption, from the reference policy). Every offer id read from a search page MUST be recorded as seen once it is resolved: filtered out, or detail-read and analyzed (or permanently failed). (amendment A14) An offer whose analysis failed only with `transient`, `rate_limit`, or `timeout` errors MUST NOT be marked seen. Offers that passed the filter but are deferred (caps, wall, budget) MUST remain pending and not be marked seen. The first successful scan of a beacon MUST be a baseline: it records all read ids as seen and MUST NOT load detail pages, analyze, or notify. Deleting a tracker record MUST NOT remove its id from the seen set.

#### Scenario: Baseline

- GIVEN a beacon that has never scanned and a results fixture of 20 offers
- WHEN the first scan completes
- THEN 20 ids are seen, 0 detail pages were loaded, 0 analyses ran, 0 notifications were shown

#### Scenario: Only new offers processed

- GIVEN a baseline with 20 ids and a second results fixture with 3 new ids, 2 passing the filter
- WHEN the second scan runs
- THEN exactly 2 detail pages are loaded and analyzed

#### Scenario: Deferred offers stay pending

- GIVEN 2 filtered new offers and the detail cap reached after the first
- WHEN the scan stops
- THEN the second offer is not in the seen set and remains pending in the queue

#### Scenario: Transient analysis failure does not burn the offer (amendment A14)

- GIVEN an analysis that fails with `transient` after all attempts
- WHEN the next scan reads the same offer
- THEN it is processed again

#### Scenario: Eviction

- GIVEN 3,000 seen ids
- WHEN a new id is recorded
- THEN the oldest id is removed and the size stays 3,000

#### Scenario: Deleted record not rediscovered

- GIVEN a seen offer whose tracker record is deleted
- WHEN a later scan reads it again
- THEN it is not treated as new

### Requirement: BEACON-5 Tab-based scan flow

A scan MUST use at most one scan tab at any time, created in the background and reused across steps, and closed when the scan ends. For each beacon the flow is: navigate the scan tab to the search URL (through the guard), classify the page (PORTAL-5), read first-page results via the adapter, apply the filter, discard seen ids, then for each new passing offer navigate to its canonical detail URL, classify, read the detail, analyze it, and persist the outcome. Only the first results page MUST be read. (amendment A14) A permanently failed offer MUST remain visible as a tracker record flagged as failed, with an action that re-queues it. If the user closes the scan tab mid-scan, the scan MUST recreate it at most once and otherwise end with status `interrupted`.

#### Scenario: Single tab

- GIVEN a scan of two beacons with several detail reads
- WHEN tab creation events are counted
- THEN at most one scan tab exists at any moment

#### Scenario: First page only

- GIVEN a results fixture advertising more pages
- WHEN scanned
- THEN no navigation to a later results page occurs

#### Scenario: Tab closed by user

- GIVEN the scan tab is closed mid-scan twice
- WHEN the second closure is detected
- THEN the scan ends with `interrupted` and queued items remain pending

#### Scenario: Unreadable detail

- GIVEN a detail read returns `unreadable`
- WHEN the step fails
- THEN it is retried up to 2 more times with backoff (assumption)
- AND after the last failure the offer is marked failed and recorded as seen

#### Scenario: Permanently failed offer stays visible and re-queueable (amendment A14)

- GIVEN an offer marked permanently failed after its last attempt
- WHEN the tracker is listed
- THEN a record for it exists, flagged as failed, with no analysis result
- AND the record offers an action that re-queues it

### Requirement: BEACON-6 Resumable paced queue

Scan work MUST be a persisted queue of steps (search, detail, analyze) with per-item state, attempt count, and next-run time. The service worker MUST execute one step per event (alarm tick or completion callback) and persist before returning. After a service-worker restart the queue MUST resume from persisted state without repeating completed steps and without analyzing the same offer twice. Overdue beacons after a browser restart MUST run at most one per tick, in due order, never as a catch-up burst.

#### Scenario: Resume after kill

- GIVEN a scan with 4 pending detail steps and the worker killed after 2 completed steps
- WHEN the worker restarts and ticks
- THEN the remaining 2 steps run and the completed 2 do not

#### Scenario: No double analysis

- GIVEN a detail step completed and persisted but the worker killed before the analyze step ran
- WHEN restarted
- THEN the offer is analyzed exactly once

#### Scenario: No catch-up burst

- GIVEN 3 beacons overdue at browser start
- WHEN the first tick occurs
- THEN only one beacon starts

### Requirement: BEACON-7 Pacing, caps, active hours and jitter

Between consecutive navigations in the scan tab the system MUST wait a randomized delay uniformly drawn from a configured range (assumption: 2.5 to 6 seconds), using an injectable random source. Defaults (assumptions): minimum interval between scheduled runs of one beacon 4 hours with a default of 8 hours; at most 3 scheduled runs per beacon per local day; at most 30 detail pages per local day across beacons; active hours 08:00 to 22:00 local time, with overnight windows supported. Each scheduled run's due time MUST include random jitter (assumption: up to 20% of the interval). Counters reset at local midnight. No scheduled step MAY run outside active hours; it is deferred to the next window start plus jitter. When a cap is reached, remaining work MUST be deferred, not dropped.

#### Scenario: Randomized delays

- GIVEN a seeded random source and range 2.5 to 6 seconds
- WHEN ten delays are drawn
- THEN all lie within the range and are not all equal

#### Scenario: Daily detail cap

- GIVEN a cap of 30 and 30 detail pages loaded today
- WHEN another detail step becomes due
- THEN it is deferred to the next local day and no navigation occurs

#### Scenario: Outside active hours

- GIVEN the time is 23:30 local and active hours are 08:00 to 22:00
- WHEN a scheduled run becomes due
- THEN no navigation occurs and the next run time is at or after 08:00

#### Scenario: Interval floor

- GIVEN the user sets an interval of 30 minutes
- WHEN settings are validated
- THEN the value is rejected or raised to the 4-hour minimum with a message

#### Scenario: Counters reset

- GIVEN caps reached on day D
- WHEN local midnight passes
- THEN counters are zero and deferred items become runnable

### Requirement: BEACON-8 Wall stop, backoff and pause

On any page classified `login`, `authwall`, `checkpoint`, or `rate_limit` (amendment A13), the scan MUST stop immediately with no further navigation in that scan and MUST record a wall event. Consecutive walls MUST produce backoffs of 2 hours, 6 hours, then 24 hours; a fourth consecutive wall MUST pause all scanning until the user resumes it (assumption on counting: the proposal states "2h/6h/24h, then pause"). No scan MAY start before the backoff expires. A scan that completes without a wall MUST reset the consecutive count. The user MUST be notified of each wall and of the pause, and for `login` the message MUST say to sign in to the portal. Manual resume MUST clear the pause and the count. (amendment A13) A page classified `unreadable_shell` MUST be re-navigated once after the pacing delay. A second `unreadable_shell` MUST end the scan without further navigation and increment a per-source layout-failure count that does not affect the wall backoff. Three consecutive scans ending this way MUST stop scanning that source with a notice that the portal layout may have changed, until the user resumes or the adapter version changes. A clean scan resets the count.

#### Scenario: Layout failure is not a wall (amendment A13)

- GIVEN two runs ending in `unreadable_shell`
- WHEN backoffs are read
- THEN no wall backoff is set

#### Scenario: Unreadable shell re-navigated once (amendment A13)

- GIVEN a page classified `unreadable_shell`
- WHEN the scan processes it
- THEN the tab is navigated to the same URL once more after the pacing delay
- AND a second `unreadable_shell` ends the scan with no further navigation and the layout-failure count incremented

#### Scenario: Layout suspect after three runs (amendment A13)

- GIVEN three consecutive scans of one source each ending in `unreadable_shell`
- WHEN the third scan ends
- THEN scanning that source stops with a notice that the portal layout may have changed
- AND it stays stopped until the user resumes or the adapter version changes

#### Scenario: Clean scan resets the layout-failure count (amendment A13)

- GIVEN two consecutive layout-failure scans
- WHEN a clean scan completes
- THEN the layout-failure count is zero

#### Scenario: Backoff ladder

- GIVEN four successive scans each ending in a wall
- WHEN backoffs are computed
- THEN the first three are 2h, 6h, 24h and the fourth sets status `paused`

#### Scenario: Immediate stop

- GIVEN the second detail navigation of a scan is classified `checkpoint`
- WHEN classification is processed
- THEN no further navigation occurs in that scan
- AND the remaining items stay pending

#### Scenario: No scan during backoff

- GIVEN a backoff until 14:00 and the time is 13:00
- WHEN a due tick or Scan now occurs
- THEN no navigation occurs

#### Scenario: Success resets

- GIVEN two consecutive walls then a clean scan after backoff
- WHEN the next wall occurs
- THEN the backoff is again 2 hours

#### Scenario: Resume

- GIVEN scanning is paused
- WHEN the user presses Resume
- THEN the pause and count are cleared and the next scan may start

### Requirement: BEACON-9 Notifications and badge

After a scan, if at least one new offer was analyzed, the system MUST show at most one notification summarizing the counts per verdict, only when notifications are enabled and the optional permission is granted. The toolbar badge MUST show the number of new analyzed results not yet viewed and MUST clear when the user opens the results. The baseline scan MUST NOT notify. Wall and pause events MUST notify regardless of the new-results setting if notifications are permitted.

#### Scenario: One summary notification

- GIVEN a scan analyzed 3 offers (1 apply, 2 skip)
- WHEN the scan completes
- THEN exactly one notification is shown with counts by verdict

#### Scenario: Notifications disabled

- GIVEN notifications are disabled
- WHEN a scan analyzes offers
- THEN no notification is shown and the badge still updates

#### Scenario: Badge cleared

- GIVEN a badge of 3
- WHEN the user opens the results list
- THEN the badge is cleared

### Requirement: BEACON-10 Budget, key and permission interplay

If an analysis step returns `budget_exceeded`, the scan MUST stop issuing analysis steps, leave remaining offers pending, notify once, and not treat it as a portal wall. If the key is missing or `auth` fails, scanning MUST not start. If a portal host permission has been revoked, scanning MUST stop with status `permission_missing` and notify.

#### Scenario: Budget stop

- GIVEN a budget reached after the first analysis of a scan with three pending offers
- WHEN the next analysis step runs
- THEN no more provider calls or detail navigations are issued
- AND two offers remain pending
- AND the wall count is unchanged

#### Scenario: Revoked permission

- GIVEN the portal permission was revoked
- WHEN a scheduled run becomes due
- THEN no navigation occurs and the status is `permission_missing`

### Requirement: BEACON-11 Terms-of-service gate

Opening the scan tab MUST be impossible unless the current version of the acknowledgement (PRIV-5) is recorded. This applies to both scheduled scans and Scan now.

#### Scenario: Gate on Scan now

- GIVEN no acknowledgement recorded
- WHEN the user presses "Scan now"
- THEN the acknowledgement screen is shown and no tab is opened
