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
