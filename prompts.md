# Prompts used by phases

## Phase 1 - Discovery

- We are at the discovery phase for a product development. Analyze these requirements and identify missing decisions, assumptions, risks, and open questions. Keep them to the essentials for an MVP project: We want users to be able to set up alerts so they get notified when something important happens in the world — like breaking news, market movements, natural disasters, that kind of thing. Should work for both email and Slack. Make it flexible enough that we can add more channels later. We need an admin view too.
- Create a requirements document for further planning with the following: Problem statement, stakeholders, sane assumptions, risks and open questions.

## Phase 2 - User stories and acceptance criteria

- According this requirements document create user stories and acceptance criteria.
  Q: Which delivery expectation should the stories assume?
  A: Exactly-once - Strongest guarantee, requires strict idempotency
  Q: What should the admin view cover in MVP?
  A: Monitoring only - View subscriptions, delivery health, and failures
  Q: What retention and audit expectations should the stories include?
  A: Minimal logs - Short-lived delivery logs for operations
- Create a story and acceptance criteria for test mode for a notification.

## Phase 3 - Architecture design

For the next phase you are a Senior Software Architect. Your task is to design the architecture for the system described in the User Stories & Acceptance Criteria.md. with the following constraints for this MVP/demo application:
Frontend (developer knowledge):

- React or Angular
- TypeScript
  Backend (developer knowledge):
- Node.js
- TypeScript
- Next.js
  Database:
- SQLite preferred unless there is a serious reason otherwise for a demo
  Architecture Preferences:
- Monolith
- Clear separation of concerns
- Extensible design
  Code Quality:
- TypeScript strict mode
- ESLint
- Prettier
- Unit testing support
  Create:

1. Architecture Overview
   Describe the chosen architecture style and why it was selected.
2. Architectural Decisions
   Document major architectural decisions and rejected alternatives.
3. Module Breakdown
   Identify major application modules and their responsibilities.
4. Integration Architecture
   Describe how external event sources will be integrated.
   Consider:

- RSS feeds
- External APIs
- Future event sources
  Describe how notification providers will be integrated. Consider:
- Email
- Slack
- Future channels
  Create an output architecture document suitable for the implementation planning phase

## Phase 3 - Architecture Refinemt
- Review the modules list and indentify areas which need further refinement before tickets/tasks creation. For example: - more detailed authentication method description. Give suggestions for more detailed descriptions
- Refine the existing Architecture.md document. Your goal is NOT to redesign the system. Your goal is to refine and complete the existing architecture so that implementation tickets can be generated immediately afterward. Fill in the gaps you identified which would be necesseary for implementation. Prefer the simplest solution that satisfies the requirements.
The MVP must be optimized for:

Fast delivery
Minimal operational complexity
Small team implementation
Low expected launch scale
Easy local development
Easy deployment
Future extensibility where it costs little to support

## Phase 3 - Data modeling and API contracts design
Based on the Architecture document define data models and API contracts.
### Data Models
For each core entity:
- Define its purpose.
- List key fields and their types.
- Define relationships to other entities.
- Document important business rules and validation constraints.
At a minimum cover:
- User
- Subscription
- AlertRule
- Event
- Delivery
- FailureRecord
Also define:
- Database tables
- Primary and foreign keys
- Unique constraints
- Required indexes
Keep the design simple and SQLite-friendly.
### API Contracts
For each major endpoint:
- Endpoint path and method
- Purpose
- Authentication requirements
- Request structure
- Response structure
- Expected error types
Cover at least:
- Authentication endpoints
- Subscription management
- Alert rule management
- Test notifications
- Monitoring and admin endpoints
Use high-level JSON examples where useful.

## Phase 4 - ticket creation
You are an expert Senior Software Engineer and Technical Product Owner. Your objective is to parse the Architecture.md document and convert it into a structured, implementation-ready backlog, which can be executed on without further refinement.
Strict Guardrails & Scope Rules:
1. Base everything STRICTLY on the provided ADR text. 
2. Do NOT introduce new architecture, design patterns, or unmentioned technologies.
3. Do NOT redesign systems or add "nice-to-have" features.
4. Do NOT over-engineer. If the ADR specifies a simple solution, ticket the simple solution.
Ensure tickets are created for:
- Authentication & authorization
- Database models & persistence layer
- Subscription management
- Alert rules
- Event ingestion
- Matching & evaluation
- Notification delivery (email + Slack)
- Admin monitoring
- Background processing (worker/jobs)
- Provider adapters
- Retention & cleanup jobs
Generate the backlog using Markdown in a separate file.