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