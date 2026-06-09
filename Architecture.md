# Architecture Overview: Alerting MVP

## 1. Architecture Overview

The recommended architecture is a single monolithic application built with Next.js, TypeScript, and React, backed by SQLite. The application should use a layered design with clear separation between presentation, application logic, domain rules, and infrastructure adapters.

The implementation should optimize for fast delivery, minimal operational complexity, small-team ownership, easy local development, easy deployment, and low launch-scale usage. When there is a tradeoff, prefer the simplest design that preserves extensibility through clear interfaces.

This style is the best fit for the MVP because it keeps implementation and deployment simple while still enforcing boundaries that support future growth. The product scope is narrow, the expected launch volume is low, and the team needs a structure that can support alert subscription management, alert evaluation, notification delivery, and an internal admin view without introducing distributed-system complexity too early.

The monolith should still be designed as if it could be split later. That means:

- UI code stays in the presentation layer.
- Business rules live in application and domain modules.
- External systems such as RSS feeds, APIs, email, and Slack are isolated behind adapters.
- Persistence is accessed through repository interfaces rather than directly from UI code.

The architecture assumes a single shared application runtime for the web UI, API routes or server actions, and background processing entry points. If background work is separated later, it should reuse the same application and domain layers.

The preferred runtime shape is a Next.js application that serves the UI and exposes server-side APIs or server actions for application operations. Background work such as alert ingestion and delivery processing can run as scheduled jobs or a lightweight worker process in the same codebase, depending on deployment needs.

## 2. Architectural Decisions

### Selected decisions

- Use a monolith rather than microservices.
  - The MVP has limited scope, a single team, and low launch scale.
  - A monolith reduces operational overhead and keeps local development straightforward.

- Use Next.js for both frontend and backend entry points.
  - This satisfies the React, Node.js, TypeScript, and full-stack requirements.
  - It supports a unified codebase for the user portal and internal admin UI.

- Use SQLite as the primary database.
  - It is the best fit for a demo or MVP with low write volume and simple operational needs.
  - It minimizes setup friction and works well for local development and lightweight deployment.

- Apply strict TypeScript throughout.
  - TypeScript strict mode should be enabled from the start.
  - Shared types should define contracts between UI, application services, and adapters.

- Use ESLint and Prettier as mandatory code quality tooling.
  - ESLint enforces correctness and architectural boundaries.
  - Prettier standardizes formatting and reduces review noise.

- Design around ports and adapters.
  - Core application services depend on interfaces, not concrete integrations.
  - This makes it easier to add future notification channels and event sources.

- Model alert delivery as idempotent processing.
  - The acceptance criteria require exactly-once behavior from the user perspective.
  - The implementation should use durable deduplication keys and stored delivery state to prevent duplicate sends.

- Keep logs minimal and time-bounded.
  - Store only the operational data needed for recent monitoring and troubleshooting.
  - Apply short retention for delivery history and failure records.

- Use a simple session-based authentication model.
  - End users and internal operators authenticate through the same application entry point.
  - Sessions carry a role claim so admin-only screens and operations can be protected consistently.
  - If an external identity provider is introduced later, it should plug into the same session boundary without changing the application services.

### Rejected alternatives

- Microservices.
  - Rejected because the MVP does not need independent scaling, separate deployables, or complex service-to-service reliability.

- Separate frontend and backend applications.
  - Rejected because it would add integration overhead without improving MVP outcomes.

- PostgreSQL as the default database.
  - PostgreSQL is more scalable, but SQLite is simpler and fully adequate for the expected MVP load.
  - PostgreSQL can remain a future migration path if volume or concurrency requires it.

- Event streaming infrastructure such as Kafka or RabbitMQ.
  - Rejected for the MVP because it would add infrastructure and operational complexity that the current scope does not justify.

- Direct provider calls from UI components.
  - Rejected because it would mix presentation with integration concerns and make future changes difficult.

- A fully generic rule engine in the first release.
  - Rejected because the current stories describe curated alert sources and predefined conditions, not a user-authored complex rule language.

## 3. Module Breakdown

The codebase should be organized by responsibility rather than by technical framework alone.

### 3.1 Presentation Module

Responsibilities:

- Render the user-facing alert subscription experience.
- Render the internal admin monitoring experience.
- Collect user input for subscriptions, unsubscriptions, and test notifications.
- Display alert health, recent failures, and delivery history.

Notes:

- This layer should contain minimal business logic.
- It should call application services rather than manipulating persistence directly.

### 3.2 Identity and Access Module

Responsibilities:

- Authenticate users.
- Distinguish end users from internal operators.
- Enforce access control for admin-only actions such as alert rule management and monitoring views.

Notes:

- Use one authentication mechanism for the MVP and enforce authorization through role-based access control.
- Recommended implementation shape: session cookies backed by Next.js server-side auth helpers, with roles such as `user` and `operator` stored in the session.
- Admin access should be checked both in the UI route layer and in server-side handlers so privileged actions cannot be reached directly.
- Keep user provisioning simple for MVP: no separate admin console for identity management, and no complex organization hierarchy.

### 3.3 Subscription Module

Responsibilities:

- Create subscriptions.
- Prevent duplicate subscriptions.
- Unsubscribe or mark subscriptions inactive.
- List active subscriptions for a user.

Core concepts:

- Subscription
- Delivery channel preference
- Subscription status

Refinement notes for tickets:

- Define the subscription uniqueness rule as one active subscription per user, alert, and delivery channel combination.
- Support a single subscription record with per-channel preferences rather than separate subscription workflows for email and Slack.
- Store `active` and `inactive` states instead of deleting records so the admin view and future troubleshooting can reuse the same record history.
- Keep subscription creation idempotent so repeated user actions return the existing subscription instead of creating duplicates.

### 3.4 Alert Definition Module

Responsibilities:

- Define curated alert rules.
- Enable and disable rules.
- Associate alert rules with predefined sources and trigger conditions.

Core concepts:

- Alert rule
- Rule status
- Source definition
- Trigger condition

Refinement notes for tickets:

- Treat alert rules as curated and operator-managed.
- For MVP, define a small fixed set of rule fields: name, source type, source identifier, trigger condition, enabled flag, and display description.
- Rule creation should validate required fields and source type before persisting.
- Disabling a rule should prevent future matches without removing historical subscription or delivery data.

### 3.5 Event Ingestion Module

Responsibilities:

- Receive events from external sources.
- Normalize source-specific payloads into an internal event model.
- Deduplicate repeated event deliveries.
- Persist ingested events for evaluation and traceability.

Core concepts:

- External event source
- Normalized event
- Idempotency key

Refinement notes for tickets:

- Support two ingestion paths in the MVP: scheduled polling for RSS feeds and API polling/webhook ingestion for external APIs.
- Normalize all inbound payloads into a single internal event shape that includes source, external identifier, timestamp, title, summary, and a deduplication key.
- Use a source-specific idempotency key plus a unique database constraint to prevent duplicate event ingestion.
- Store only the fields needed for matching, delivery, and short-term operational review.

### 3.6 Matching and Evaluation Module

Responsibilities:

- Match incoming events against active alert rules and subscriptions.
- Determine which subscriptions should receive notifications.
- Create delivery work items while preserving idempotency.

Core concepts:

- Match result
- Notification candidate
- Delivery task

Refinement notes for tickets:

- Evaluate matches through a deterministic service that receives one normalized event and returns a list of candidate deliveries.
- Run matching in the same application codebase as ingestion to keep the MVP simple; if a queue is added later, it should only wrap this service.
- Persist the evaluation result or downstream delivery task only when needed for idempotency and admin visibility.
- Keep matching rules intentionally simple: source and trigger conditions from the curated rule set are sufficient for MVP.

### 3.7 Notification Orchestration Module

Responsibilities:

- Route notification tasks to the correct provider.
- Track delivery attempts and final status.
- Support test notification flows without creating real subscriptions or production alert side effects.

Core concepts:

- Notification request
- Delivery attempt
- Delivery status

Refinement notes for tickets:

- Use a small delivery state machine: queued, sending, sent, failed, and skipped.
- Enforce idempotency at the orchestration layer so reprocessing the same event does not send duplicate notifications.
- Track the last error message, provider response summary, and timestamps for recent attempts.
- Keep retries simple and bounded if they are added: retry only transient failures and cap attempts to a small number.
- Test notifications should follow the same provider adapters but bypass subscription creation and alert triggering logic.

### 3.8 Provider Adapter Module

Responsibilities:

- Implement channel-specific delivery for email and Slack.
- Hide provider-specific APIs, formatting, and retry behavior from the core application.
- Provide a shared contract for future channels.

Core concepts:

- Notification provider interface
- Email adapter
- Slack adapter

Refinement notes for tickets:

- Use one interface per provider with methods for sending a normalized message and translating provider errors.
- Decide the email transport during implementation planning: SMTP for the simplest local setup, or a single email API provider if deployment simplicity is more important than self-hosting.
- For Slack, prefer a webhook or bot-token based adapter depending on the least configuration overhead for the target demo environment.
- Keep channel-specific message formatting inside the adapter or a shared renderer so the orchestration layer stays provider-agnostic.

### 3.9 Monitoring and Retention Module

Responsibilities:

- Record recent delivery failures and delivery history.
- Provide admin-friendly summary data.
- Apply retention policies to operational records.

Core concepts:

- Delivery log entry
- Failure record
- Health summary

Refinement notes for tickets:

- Keep admin monitoring read-only for MVP.
- Expose only recent delivery records, recent failures, and a summarized health state.
- Retention can be implemented as a scheduled cleanup job that removes records older than the short operational window defined in the requirements.
- Keep the stored log payload minimal: alert identifier, channel, timestamp, status, and a short failure reason where applicable.

## 4. Integration Architecture

### 4.1 External Event Sources

External event sources should integrate through inbound adapters that convert source-specific payloads into a shared internal event model.

Supported MVP-style source types:

- RSS feeds
- External APIs

Future source types should plug into the same pattern without changing the core matching logic.

#### RSS feeds

- A scheduled ingestion job polls configured RSS feeds on an interval.
- The adapter extracts feed items and converts them into normalized events.
- Each item should carry a stable deduplication key derived from the feed source and item identity.
- The ingestion layer stores only the data needed for matching, auditing, and recent troubleshooting.

#### External APIs

- API-based sources should enter the system through either polling jobs or webhook endpoints, depending on the provider.
- Webhook payloads should be validated, normalized, and deduplicated before entering the matching pipeline.
- Polling integrations should use a cursor or last-seen marker to avoid reprocessing the same data.

#### Future event sources

- Add new source adapters behind a common ingestion interface.
- Keep normalization isolated so source-specific schema changes do not propagate into notification logic.
- If a future source requires high-volume ingestion, it can be offloaded later without changing the domain model.

### 4.2 Notification Providers

Notification delivery should use an outbound provider interface with one adapter per channel.

#### Email

- The email adapter formats the notification payload for email delivery.
- It is responsible for provider-specific API interaction and provider error mapping.
- Delivery attempts and outcomes are recorded centrally in the application layer.

#### Slack

- The Slack adapter formats the notification payload for Slack message delivery.
- It handles channel configuration, API calls, and provider-specific failures.
- Like email, it should be replaceable without affecting the matching pipeline.

#### Future channels

- New channels should implement the same provider interface.
- The core notification orchestration layer should not need to know the details of each provider.
- Channel-specific content formatting should remain in the adapter layer or a shared message-rendering component.

### 4.3 Processing Flow

The recommended flow is:

1. An external source emits or exposes an event.
2. The ingestion adapter normalizes the event and assigns an idempotency key.
3. The event is stored and evaluated against active alert rules and subscriptions.
4. Matching subscriptions generate delivery tasks.
5. The notification orchestration layer routes each task to email or Slack.
6. The result is written to the delivery log and surfaced in the admin view.

This flow keeps integration complexity out of the UI and ensures that failure visibility is available for operators.

### 4.4 Operational Boundaries

- The web application should own admin UI and user-facing UI concerns.
- The same codebase should own ingestion, matching, and notification orchestration logic.
- Background processing may run as an in-process job in development and as a separate Node process in production if needed, but it should not require a different architecture.
- SQLite should remain the default persistence layer for the MVP; if a later scale-up requires migration, the repository layer should contain the change.

## 5. Implementation Guidance

The implementation phase should preserve the following boundaries:

- UI components should call application services only.
- Application services should own orchestration and transactional consistency.
- Domain objects should express subscription, alert, event, and delivery concepts.
- Infrastructure should contain database access, provider APIs, scheduling, and external source integrations.

Recommended supporting practices:

- Use repository interfaces for persistence access.
- Use shared DTOs or mappers at layer boundaries.
- Keep provider payload mapping deterministic for easier testing.
- Add unit tests for matching, deduplication, and provider selection logic before implementing broad integration coverage.

Implementation-ready ticketing should cover:

- Authentication and role checks.
- Database entities and uniqueness constraints.
- Subscription create, list, and deactivate flows.
- Rule create, enable, and disable flows.
- Event ingestion normalization and deduplication.
- Delivery orchestration and provider adapters.
- Admin monitoring and retention cleanup.

Suggested core entities for planning:

- User
- Role or permission claim
- AlertRule
- Subscription
- IngestedEvent
- Delivery
- DeliveryAttempt
- FailureLog

## 6. Suggested Delivery Shape For MVP

For the MVP, the simplest practical deployment shape is:

- One Next.js application.
- One SQLite database file.
- One scheduled worker process or job runner for ingestion and delivery processing, if background execution is not handled inside the web process.

This keeps the system easy to deploy for a demo while still leaving room to evolve toward separate worker processes, stronger databases, and more providers later.

## 7. Data Model Reference

This section defines the core entities for implementation planning. The schema is intentionally small and maps cleanly to SQLite tables with straightforward foreign keys and unique constraints.

### 7.1 User

Purpose:

- Represents an authenticated person using the system as an end user or internal operator.

Key fields:

- `id: string` - primary key, use UUID or ULID stored as text.
- `email: string` - unique login and contact identifier.
- `display_name: string | null` - optional human-readable name.
- `role: "user" | "operator"` - authorization role.
- `status: "active" | "disabled"` - account state.
- `created_at: string` - ISO timestamp.
- `updated_at: string` - ISO timestamp.

Relationships:

- One user has many subscriptions.
- One user can create many deliveries indirectly through subscriptions.

Business rules and validation:

- Email is required and unique.
- Role must be one of the supported values.
- Disabled users cannot create or manage subscriptions and cannot access admin endpoints.

Table: `users`

- Primary key: `id`
- Unique constraints: `email`
- Required indexes: `idx_users_email`, `idx_users_role`, `idx_users_status`

### 7.2 Subscription

Purpose:

- Represents a user’s subscription to a curated alert rule for one or more delivery channels.

Key fields:

- `id: string` - primary key.
- `user_id: string` - foreign key to `users.id`.
- `alert_rule_id: string` - foreign key to `alert_rules.id`.
- `channel: "email" | "slack"` - delivery channel.
- `status: "active" | "inactive"` - subscription state.
- `created_at: string` - ISO timestamp.
- `updated_at: string` - ISO timestamp.
- `deactivated_at: string | null` - timestamp when made inactive.

Relationships:

- Many subscriptions belong to one user.
- Many subscriptions belong to one alert rule.
- One subscription can produce many deliveries over time.

Business rules and validation:

- A user may have only one active subscription per alert rule and channel combination.
- Subscriptions should be marked inactive rather than deleted for MVP.
- Channel must match a supported provider.
- User and alert rule must both exist and be active at the time of subscription creation.

Table: `subscriptions`

- Primary key: `id`
- Foreign keys: `user_id -> users.id`, `alert_rule_id -> alert_rules.id`
- Unique constraints: `(user_id, alert_rule_id, channel)`
- Required indexes: `idx_subscriptions_user_id`, `idx_subscriptions_alert_rule_id`, `idx_subscriptions_status`, `idx_subscriptions_user_status`

### 7.3 AlertRule

Purpose:

- Represents a curated alert definition managed by an internal operator.

Key fields:

- `id: string` - primary key.
- `name: string` - display name.
- `description: string | null` - human-readable rule summary.
- `source_type: "rss" | "api"` - source category.
- `source_identifier: string` - source URL, feed id, or provider identifier.
- `trigger_condition: string` - simple serialized condition or rule token for MVP.
- `status: "enabled" | "disabled"` - rule state.
- `created_by_user_id: string` - foreign key to `users.id`.
- `created_at: string` - ISO timestamp.
- `updated_at: string` - ISO timestamp.

Relationships:

- One alert rule can have many subscriptions.
- One alert rule can match many events.

Business rules and validation:

- Name, source type, source identifier, and trigger condition are required.
- Only operators can create or change rules.
- Disabled rules must not generate new deliveries.
- `trigger_condition` should remain simple and parseable by the matching service; avoid a full user-authored expression language for MVP.

Table: `alert_rules`

- Primary key: `id`
- Foreign keys: `created_by_user_id -> users.id`
- Unique constraints: optionally `(source_type, source_identifier, name)` if duplicate rule names per source should be prevented
- Required indexes: `idx_alert_rules_status`, `idx_alert_rules_source_type`, `idx_alert_rules_source_identifier`

### 7.4 Event

Purpose:

- Represents a normalized internal event ingested from RSS feeds or external APIs.

Key fields:

- `id: string` - primary key.
- `source_type: "rss" | "api"` - source category.
- `source_identifier: string` - source instance or provider identifier.
- `external_event_id: string` - provider item id, guid, webhook id, or equivalent.
- `dedup_key: string` - stable idempotency key.
- `title: string` - normalized title.
- `summary: string | null` - normalized summary or excerpt.
- `event_url: string | null` - canonical source URL.
- `occurred_at: string` - event timestamp.
- `payload_json: string` - serialized original or normalized payload.
- `created_at: string` - ISO timestamp.

Relationships:

- One event can generate many deliveries.
- One event can have many matching results if the system stores evaluation records later.

Business rules and validation:

- `dedup_key` must be unique.
- `external_event_id` should be unique per `source_type` and `source_identifier` if the provider supplies a stable identifier.
- Store only the payload data required for matching, operational visibility, and debugging.

Table: `events`

- Primary key: `id`
- Unique constraints: `dedup_key`, optionally `(source_type, source_identifier, external_event_id)`
- Required indexes: `idx_events_source_type`, `idx_events_source_identifier`, `idx_events_occurred_at`, `idx_events_dedup_key`

### 7.5 Delivery

Purpose:

- Represents a notification delivery attempt for a given event, subscription, and channel.

Key fields:

- `id: string` - primary key.
- `event_id: string` - foreign key to `events.id`.
- `subscription_id: string` - foreign key to `subscriptions.id`.
- `channel: "email" | "slack"` - delivery channel.
- `status: "queued" | "sending" | "sent" | "failed" | "skipped"` - delivery state.
- `attempt_count: number` - number of send attempts.
- `provider_message_id: string | null` - provider response id when available.
- `failure_record_id: string | null` - foreign key to `failure_records.id`.
- `queued_at: string` - ISO timestamp.
- `sent_at: string | null` - ISO timestamp.
- `updated_at: string` - ISO timestamp.

Relationships:

- Many deliveries belong to one event.
- Many deliveries belong to one subscription.
- A delivery may reference one failure record.

Business rules and validation:

- One delivery should exist for each event-subscription-channel combination.
- The orchestration layer must ensure idempotency before creating a delivery.
- `attempt_count` must not exceed the configured retry cap.
- `status` transitions should only follow the small state machine defined in the architecture.

Table: `deliveries`

- Primary key: `id`
- Foreign keys: `event_id -> events.id`, `subscription_id -> subscriptions.id`, `failure_record_id -> failure_records.id`
- Unique constraints: `(event_id, subscription_id, channel)`
- Required indexes: `idx_deliveries_event_id`, `idx_deliveries_subscription_id`, `idx_deliveries_channel`, `idx_deliveries_status`, `idx_deliveries_queued_at`

### 7.6 FailureRecord

Purpose:

- Captures recent operational failure details for admin monitoring and troubleshooting.

Key fields:

- `id: string` - primary key.
- `delivery_id: string` - foreign key to `deliveries.id`.
- `failure_type: string` - normalized failure category.
- `provider_name: string` - `email` or `slack` provider identifier.
- `error_message: string` - short human-readable failure summary.
- `error_code: string | null` - provider or internal code.
- `failure_payload_json: string | null` - minimal serialized provider response or diagnostic payload.
- `created_at: string` - ISO timestamp.

Relationships:

- One failure record belongs to one delivery.
- A delivery may have zero or one current failure record for MVP; additional attempts can overwrite or append depending on the implementation choice, but the schema should remain simple.

Business rules and validation:

- Keep failure details minimal and time-bounded.
- Do not store secrets or full provider payloads.
- Failure records should be retained only for the short operational window required by the requirements.

Table: `failure_records`

- Primary key: `id`
- Foreign keys: `delivery_id -> deliveries.id`
- Unique constraints: `delivery_id` if only one current failure record is stored per delivery
- Required indexes: `idx_failure_records_delivery_id`, `idx_failure_records_created_at`, `idx_failure_records_provider_name`

### 7.7 Supporting Tables

The following supporting tables are recommended for implementation, even though they are not part of the minimum entity list:

- `sessions` - if auth sessions are persisted in the application database.
- `delivery_attempts` - if individual retry attempts need to be tracked separately from the current delivery state.
- `retention_jobs` or `job_runs` - if scheduled maintenance needs its own audit trail.

These should remain optional until the implementation plan confirms that they are needed.

## 8. API Contract Reference

API endpoints are described at a high level and can be implemented as Next.js route handlers or server actions. JSON shapes are intentionally simple and compatible with SQLite-backed application services.

### 8.1 Authentication Endpoints

#### POST /api/auth/login

Purpose:

- Authenticates a user and creates a session.

Authentication:

- None required.

Request:

```json
{
  "email": "user@example.com",
  "password": "optional-or-provider-specific"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "displayName": "Alex Chen",
    "role": "user"
  }
}
```

Errors:

- `400 Bad Request` for invalid payload.
- `401 Unauthorized` for invalid credentials.
- `403 Forbidden` if the account is disabled.

#### POST /api/auth/logout

Purpose:

- Invalidates the current session.

Authentication:

- Required.

Request:

- No body required.

Response:

```json
{
  "success": true
}
```

Errors:

- `401 Unauthorized` if no session exists.

#### GET /api/auth/me

Purpose:

- Returns the current authenticated user and role.

Authentication:

- Required.

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "displayName": "Alex Chen",
    "role": "operator"
  }
}
```

Errors:

- `401 Unauthorized` if the session is missing or invalid.

### 8.2 Subscription Management

#### GET /api/subscriptions

Purpose:

- Lists the authenticated user’s active and inactive subscriptions.

Authentication:

- Required.

Response:

```json
{
  "items": [
    {
      "id": "sub_123",
      "alertRuleId": "rule_001",
      "alertRuleName": "Breaking News",
      "channel": "email",
      "status": "active"
    }
  ]
}
```

Errors:

- `401 Unauthorized` if not logged in.

#### POST /api/subscriptions

Purpose:

- Creates a subscription for the current user.

Authentication:

- Required.

Request:

```json
{
  "alertRuleId": "rule_001",
  "channel": "email"
}
```

Response:

```json
{
  "subscription": {
    "id": "sub_123",
    "alertRuleId": "rule_001",
    "channel": "email",
    "status": "active"
  }
}
```

Errors:

- `400 Bad Request` for missing or invalid fields.
- `401 Unauthorized` if not logged in.
- `404 Not Found` if the alert rule does not exist.
- `409 Conflict` if an active subscription already exists for the same user, alert, and channel.

#### PATCH /api/subscriptions/{subscriptionId}

Purpose:

- Updates a subscription status, typically to deactivate it.

Authentication:

- Required.

Request:

```json
{
  "status": "inactive"
}
```

Response:

```json
{
  "subscription": {
    "id": "sub_123",
    "status": "inactive"
  }
}
```

Errors:

- `400 Bad Request` for invalid status.
- `401 Unauthorized` if not logged in.
- `404 Not Found` if the subscription does not exist or does not belong to the caller.

### 8.3 Alert Rule Management

#### GET /api/admin/alert-rules

Purpose:

- Lists curated alert rules for operators.

Authentication:

- Required.
- Operator role required.

Response:

```json
{
  "items": [
    {
      "id": "rule_001",
      "name": "Breaking News",
      "sourceType": "rss",
      "sourceIdentifier": "https://example.com/feed.xml",
      "status": "enabled"
    }
  ]
}
```

Errors:

- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.

#### POST /api/admin/alert-rules

Purpose:

- Creates a curated alert rule.

Authentication:

- Required.
- Operator role required.

Request:

```json
{
  "name": "Breaking News",
  "description": "Important news alerts",
  "sourceType": "rss",
  "sourceIdentifier": "https://example.com/feed.xml",
  "triggerCondition": "contains:breaking"
}
```

Response:

```json
{
  "alertRule": {
    "id": "rule_001",
    "status": "enabled"
  }
}
```

Errors:

- `400 Bad Request` for validation failures.
- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.

#### PATCH /api/admin/alert-rules/{alertRuleId}

Purpose:

- Enables or disables an alert rule.

Authentication:

- Required.
- Operator role required.

Request:

```json
{
  "status": "disabled"
}
```

Response:

```json
{
  "alertRule": {
    "id": "rule_001",
    "status": "disabled"
  }
}
```

Errors:

- `400 Bad Request` for invalid status.
- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.
- `404 Not Found` if the rule does not exist.

### 8.4 Test Notifications

#### POST /api/admin/test-notifications

Purpose:

- Sends a test notification through email or Slack without creating a real subscription or production alert.

Authentication:

- Required.
- Operator role required.

Request:

```json
{
  "channel": "slack",
  "target": "optional destination override",
  "message": "Test notification from the admin console"
}
```

Response:

```json
{
  "result": {
    "status": "sent",
    "channel": "slack",
    "providerMessageId": "msg_123"
  }
}
```

Errors:

- `400 Bad Request` for invalid channel or payload.
- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.
- `422 Unprocessable Entity` if the selected channel is not configured.
- `502 Bad Gateway` if the provider call fails.

### 8.5 Monitoring and Admin Endpoints

#### GET /api/admin/monitoring/summary

Purpose:

- Returns a high-level health summary for subscriptions and delivery activity.

Authentication:

- Required.
- Operator role required.

Response:

```json
{
  "activeSubscriptions": 124,
  "recentDeliveries": 38,
  "recentFailures": 2,
  "health": "degraded"
}
```

Errors:

- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.

#### GET /api/admin/deliveries

Purpose:

- Lists recent delivery records for monitoring.

Authentication:

- Required.
- Operator role required.

Query parameters:

- `status` - optional filter.
- `channel` - optional filter.
- `limit` - optional result limit.

Response:

```json
{
  "items": [
    {
      "id": "del_123",
      "eventId": "evt_001",
      "subscriptionId": "sub_123",
      "channel": "email",
      "status": "sent",
      "sentAt": "2026-06-09T10:00:00Z"
    }
  ]
}
```

Errors:

- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.

#### GET /api/admin/failures

Purpose:

- Lists recent failure records.

Authentication:

- Required.
- Operator role required.

Response:

```json
{
  "items": [
    {
      "id": "fail_123",
      "deliveryId": "del_123",
      "providerName": "slack",
      "errorMessage": "Webhook rejected",
      "createdAt": "2026-06-09T10:01:00Z"
    }
  ]
}
```

Errors:

- `401 Unauthorized` if not logged in.
- `403 Forbidden` if the user is not an operator.

### 8.6 Shared Error Pattern

For most endpoints, use a consistent JSON error response:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "alertRuleId is required"
  }
}
```

Recommended error codes:

- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `UNPROCESSABLE_ENTITY`
- `PROVIDER_FAILURE`
- `INTERNAL_ERROR`
