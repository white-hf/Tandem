# TAN-8 Human Verification Regression Checklist

Use a disposable or intentionally reviewable Issue. Do not use a production delivery decision only to exercise the UI.

## Open verification

- Open Project **Attention** and locate an Issue with `is ready for verification`.
- Click **Review issue →**.
- Confirm the right workspace has the accessible title **Human Verification**, a green verification banner, and the URL ends in `/work/<ISSUE-KEY>/verify`.
- Confirm opening or closing the workspace does not change the Issue or record a Human decision.

## Review context

- Confirm intent, acceptance criteria, delivery path/risk, Git delivery, evidence, and handoff are visible before the decision form.
- Confirm the form explains the difference between completion and requested changes.
- Confirm both decision buttons remain disabled until the rationale contains at least five characters.

## Request changes

- Enter a specific requested-change rationale and choose **Request changes**.
- Confirm the workspace closes, the Attention review item disappears, and Work shows the Issue as Ready or Blocked according to current dependencies/context.
- Confirm the previous active claim is gone while prior Session, Evidence, and Handoff remain visible.
- Confirm Activity contains `issue.changes_requested`, the signed-in Human, and the rationale.

## Approve and complete

- Submit a new Agent handoff for the revised Issue so it returns to Review.
- Open Human Verification, enter the approval rationale, and choose **Approve & complete**.
- Confirm the workspace closes, the Attention review item disappears, and Work shows Done.
- Confirm Activity contains `issue.completed` with the signed-in Human rationale.

## Authority and recovery

- Confirm an Agent token receives `403 AUTHORIZATION_DENIED` from the Human review endpoint.
- Confirm a failed API response leaves the form open and displays an error without losing the entered rationale.
- Confirm browser Back/Forward restores or closes the Issue-specific verification workspace without recording a decision.
