# Tandem Delivery Instructions

This repository uses Tandem as its durable Agent-first delivery memory.

## Before implementation

1. If the Human names an Issue, call Tandem `start_session` with the Issue key and current Git remote. Your stable Agent identity comes from the authenticated MCP credential.
2. If no Issue is named, call `get_project_context` or start a Project Session before proposing plans or changes.
3. Read every required Artifact revision, repository document, code anchor, and verification command returned by the onboarding manifest.
4. Inspect the relevant existing code. Do not acknowledge an item you did not actually read.
5. Call `confirm_understanding` with a concise understanding, intended changes, and real open questions.
6. Call `claim_issue` only after Tandem reports the Issue Ready. Do not work around another active claim.

## During delivery

- keep Product/Design conclusions in versioned Tandem Artifacts and accepted engineering documents in Git;
- create dependencies before parallel work starts;
- record a checkpoint at semantic boundaries, not after every command;
- attach reproducible test/build/Git/experience evidence;
- request Human attention only for policy, risk, ambiguity, destructive action, or material trade-offs;
- never report a Human decision as `human_decision`; conversation-derived statements use `human_stated` provenance;
- do not store raw chat transcripts, secrets, or private chain-of-thought.

## Before leaving the task

Run the required verification, attach Evidence, and call `submit_handoff` with changes, validation, residual risks, and next steps. A handoff is required even when another Agent will continue immediately.
