# Implementation Backlog: Alerting MVP

This backlog is derived strictly from [Architecture.md](Architecture.md) and stays within the documented scope, technologies, and operating model.

## Delivery Order

Work items are ordered to establish the platform first, then the core data and access model, then the user and operator workflows, followed by ingestion, matching, delivery, and operational cleanup.

## P0. Platform Foundation

### T-001: Establish the Next.js monolith scaffold

Build the single Next.js application that will host the UI, API routes or server actions, and background entry points.

Scope:

- Create the application structure for presentation, application, domain, and infrastructure layers.
- Enable strict TypeScript.
- Add ESLint and Prettier as required code quality tooling.

Acceptance criteria:

- The project runs as one Next.js application.
- TypeScript strict mode is enabled.
- ESLint and Prettier are configured and runnable.
- Layer boundaries are reflected in the folder structure.

Dependencies: none

### T-002: Set up SQLite persistence and repository interfaces

Create the persistence foundation for the monolith using SQLite and repository interfaces.

Scope:

- Add the SQLite database connection and access layer.
- Define repository interfaces instead of direct persistence access from UI code.
- Prepare the application for transactional use by services.

Acceptance criteria:

- SQLite is the default database.
- Application services depend on repository interfaces.
- UI code does not access the database directly.

Dependencies: T-001

## P0. Data Model & Persistence Layer

### T-010: Implement core user and session storage

Persist users and sessions with the fields and states described in the architecture.

Scope:

- Create the `users` table with role and status fields.
- Add session storage if sessions are persisted in the application database.
- Enforce unique email addresses.

Acceptance criteria:

- Users can be stored with `user` or `operator` roles.
- Disabled users are representable in storage.
- Session records can be created, read, and invalidated.

Dependencies: T-002

### T-011: Implement alert rule storage

Persist curated alert rules with the required fields and status.

Scope:

- Create the `alert_rules` table.
- Store name, description, source type, source identifier, trigger condition, status, creator, and timestamps.
- Add the documented indexes and constraints.

Acceptance criteria:

- Alert rules can be created, enabled, and disabled.
- Required fields are persisted.
- Operator ownership can be tracked through `created_by_user_id`.

Dependencies: T-010

### T-012: Implement subscription storage

Persist subscriptions with active and inactive states and the required uniqueness rule.

Scope:

- Create the `subscriptions` table.
- Store user, alert rule, channel, status, timestamps, and deactivation time.
- Enforce one subscription per user, alert rule, and channel combination.

Acceptance criteria:

- Duplicate active subscriptions cannot be created for the same user, alert rule, and channel.
- Subscriptions can be marked inactive instead of deleted.
- Required indexes are present.

Dependencies: T-010, T-011

### T-013: Implement event storage

Persist normalized ingested events with deduplication support.

Scope:

- Create the `events` table.
- Store normalized event fields, payload JSON, and timestamps.
- Enforce uniqueness for `dedup_key`.

Acceptance criteria:

- Ingested events can be stored once per deduplication key.
- The event record contains the fields needed for matching and traceability.

Dependencies: T-002

### T-014: Implement delivery and failure record storage

Persist delivery state and recent failure details for monitoring and idempotency.

Scope:

- Create the `deliveries` table with queued, sending, sent, failed, and skipped states.
- Create the `failure_records` table for short operational failure details.
- Enforce one delivery per event, subscription, and channel combination.

Acceptance criteria:

- Delivery records track state transitions and attempt count.
- Failure records can be linked to a delivery.
- Duplicate delivery rows for the same event, subscription, and channel are prevented.

Dependencies: T-012, T-013

## P0. Authentication & Authorization

### T-020: Implement session-based authentication

Build the login, logout, and current-user flow using the session-based model described in the architecture.

Scope:

- Implement session creation and invalidation.
- Implement current-user lookup.
- Return the authenticated user and role from the auth endpoints.

Acceptance criteria:

- Users can log in and obtain a session.
- Users can log out and invalidate the session.
- `/api/auth/me` returns the current authenticated user.

Dependencies: T-010

### T-021: Implement role-based authorization checks

Enforce the `user` and `operator` access model across UI routes and server-side handlers.

Scope:

- Protect admin-only screens and actions.
- Enforce authorization in server-side handlers, not only in the UI.
- Block disabled users from creating or managing subscriptions and from accessing admin endpoints.

Acceptance criteria:

- Operator-only routes reject non-operators.
- Disabled users cannot access protected actions.
- Authorization is checked in both route/UI entry points and server-side handlers.

Dependencies: T-020

## P0. Subscription Management

### T-030: Implement subscription creation

Create subscriptions for the current authenticated user with idempotent behavior.

Scope:

- Implement `POST /api/subscriptions`.
- Validate alert rule existence and status.
- Prevent duplicate active subscriptions for the same user, alert rule, and channel.

Acceptance criteria:

- A new active subscription can be created for a valid alert rule and channel.
- Repeated creation attempts return the existing subscription instead of creating duplicates.
- Invalid or missing fields return validation errors.

Dependencies: T-012, T-020, T-021

### T-031: Implement subscription listing and deactivation

Allow users to list their subscriptions and mark them inactive.

Scope:

- Implement `GET /api/subscriptions`.
- Implement `PATCH /api/subscriptions/{subscriptionId}`.
- Return active and inactive subscriptions for the authenticated user.

Acceptance criteria:

- Users can list their own subscriptions.
- Users can mark their own subscriptions inactive.
- Subscriptions are not deleted for MVP.

Dependencies: T-012, T-020, T-021, T-030

## P0. Alert Rules

### T-040: Implement operator alert rule creation

Allow operators to create curated alert rules with the documented fields.

Scope:

- Implement `POST /api/admin/alert-rules`.
- Validate required fields, source type, and source identifier before persistence.
- Store the creator as the current operator.

Acceptance criteria:

- Only operators can create alert rules.
- Required fields are validated.
- Newly created rules are stored with an enabled status.

Dependencies: T-011, T-020, T-021

### T-041: Implement operator alert rule listing and status updates

Allow operators to list alert rules and enable or disable them.

Scope:

- Implement `GET /api/admin/alert-rules`.
- Implement `PATCH /api/admin/alert-rules/{alertRuleId}`.
- Support enabling and disabling rules without deleting history.

Acceptance criteria:

- Only operators can access the routes.
- Rules can be listed with the documented fields.
- Disabled rules do not generate future matches.

Dependencies: T-011, T-020, T-021, T-040

## P0. Event Ingestion

### T-050: Implement event normalization and deduplication

Normalize RSS and API inputs into the internal event model and prevent duplicate ingestion.

Scope:

- Normalize incoming payloads into the required event shape.
- Assign and persist a stable deduplication key.
- Reject repeated events using the database uniqueness constraint.

Acceptance criteria:

- RSS and API inputs are normalized to one internal event shape.
- Duplicate inbound items do not create duplicate event records.
- Stored events include source, external identifier, timestamp, title, summary, and dedup key.

Dependencies: T-013

### T-051: Implement RSS feed ingestion

Add the scheduled RSS polling path described in the architecture.

Scope:

- Poll configured RSS feeds on an interval.
- Extract feed items and convert them into normalized events.
- Use a stable item identity for deduplication.

Acceptance criteria:

- RSS feeds are polled by a scheduled process.
- Feed items are normalized and persisted once.
- Repeated polling of the same item does not create duplicates.

Dependencies: T-050

### T-052: Implement API ingestion path

Add the API-based ingestion path described in the architecture.

Scope:

- Support API polling or webhook ingestion depending on the provider.
- Validate and normalize inbound payloads before persistence.
- Use a cursor or last-seen marker for polling integrations when needed.

Acceptance criteria:

- API events enter through polling or webhook handlers.
- Payloads are normalized before matching.
- Duplicate provider deliveries are deduplicated.

Dependencies: T-050

## P0. Matching & Evaluation

### T-060: Implement deterministic matching service

Create the service that evaluates one normalized event against active alert rules and subscriptions.

Scope:

- Compare a single event with the curated rule set.
- Return the list of candidate deliveries.
- Keep matching logic intentionally simple and deterministic.

Acceptance criteria:

- Matching receives one event and returns candidate deliveries.
- Disabled rules are ignored.
- The service is testable without provider calls.

Dependencies: T-011, T-012, T-013

### T-061: Implement delivery task creation with idempotency

Persist delivery work only once for each event, subscription, and channel combination.

Scope:

- Create delivery records when a match exists.
- Prevent duplicate delivery tasks.
- Preserve delivery state for admin visibility and retry handling.

Acceptance criteria:

- The same event does not produce duplicate deliveries for the same subscription and channel.
- Delivery state is persisted centrally.

Dependencies: T-014, T-060

## P0. Notification Delivery

### T-070: Implement notification orchestration

Route delivery tasks to the correct provider and track the delivery state machine.

Scope:

- Implement the queued, sending, sent, failed, and skipped states.
- Record attempt count and final delivery outcome.
- Enforce orchestration-level idempotency.

Acceptance criteria:

- Delivery tasks move through the documented states.
- Reprocessing the same event does not send duplicate notifications.
- Attempt count and timestamps are recorded.

Dependencies: T-014, T-061

### T-071: Implement the email provider adapter

Add the email delivery adapter behind the shared provider contract.

Scope:

- Implement the email adapter interface for normalized message delivery.
- Map provider errors into application-level failures.
- Keep email-specific formatting in the adapter or shared renderer.

Acceptance criteria:

- Email notifications can be sent through the adapter.
- Provider failures are translated into normalized failures.
- The orchestration layer does not depend on provider-specific details.

Dependencies: T-070

### T-072: Implement the Slack provider adapter

Add the Slack delivery adapter behind the shared provider contract.

Scope:

- Implement the Slack adapter interface for normalized message delivery.
- Map provider errors into application-level failures.
- Keep Slack-specific formatting in the adapter or shared renderer.

Acceptance criteria:

- Slack notifications can be sent through the adapter.
- Provider failures are translated into normalized failures.
- The orchestration layer stays provider-agnostic.

Dependencies: T-070

### T-073: Implement test notifications

Support operator-triggered test notifications that do not create real subscriptions or alert side effects.

Scope:

- Implement `POST /api/admin/test-notifications`.
- Route test sends through the same provider adapters.
- Bypass subscription creation and alert triggering logic.

Acceptance criteria:

- Operators can send test notifications.
- Test notifications use the configured provider path.
- Test sends do not create subscriptions or alert deliveries.

Dependencies: T-021, T-071, T-072

## P0. Admin Monitoring

### T-080: Implement monitoring summary

Expose the operator health summary for active subscriptions, recent deliveries, recent failures, and health state.

Scope:

- Implement `GET /api/admin/monitoring/summary`.
- Calculate the summary from persisted operational data.
- Keep the view read-only.

Acceptance criteria:

- Operators can retrieve the summary.
- Summary values reflect persisted delivery and failure data.
- The endpoint is read-only.

Dependencies: T-012, T-014, T-021

### T-081: Implement delivery history listing

Expose recent delivery records for operators.

Scope:

- Implement `GET /api/admin/deliveries`.
- Support optional `status`, `channel`, and `limit` filters.
- Return the fields documented in the architecture.

Acceptance criteria:

- Operators can list recent deliveries.
- Filters work as described.
- The endpoint remains read-only.

Dependencies: T-014, T-021

### T-082: Implement failure history listing

Expose recent failure records for operators.

Scope:

- Implement `GET /api/admin/failures`.
- Return the documented failure fields.
- Keep the endpoint read-only.

Acceptance criteria:

- Operators can list recent failures.
- Failure records are limited to the recent operational window.
- The endpoint remains read-only.

Dependencies: T-014, T-021

## P0. Background Processing

### T-090: Implement background worker/job entry points

Add the worker or scheduled job entry points that process ingestion and delivery in the same codebase.

Scope:

- Add a background runtime path for ingestion and delivery processing.
- Reuse the same application and domain layers as the web runtime.
- Keep the deployment model consistent with the monolith described in the architecture.

Acceptance criteria:

- Background processing can run separately from the web process if needed.
- Ingestion and delivery processing reuse the same application logic.
- No separate architecture is introduced.

Dependencies: T-050, T-070

## P0. Retention & Cleanup

### T-100: Implement retention cleanup for operational records

Remove delivery history and failure data older than the short operational window defined in the requirements.

Scope:

- Add a scheduled cleanup job.
- Delete or otherwise remove operational records outside the retention window.
- Keep the stored log payload minimal.

Acceptance criteria:

- Old delivery and failure records are cleaned up on schedule.
- Recent operational records remain available for admin monitoring.
- The cleanup job stays within the documented retention model.

Dependencies: T-014, T-090

## Suggested Execution Sequence

1. Complete the platform foundation and persistence layer.
2. Implement authentication, authorization, and the core data model.
3. Deliver subscription and alert rule management.
4. Add ingestion, matching, and delivery orchestration.
5. Finish admin monitoring, background processing, and retention cleanup.
