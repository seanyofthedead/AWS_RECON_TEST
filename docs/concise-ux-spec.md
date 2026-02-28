# Concise UX Spec

## Glossary (tooltips)
- Variance: Difference between expected and actual amount.
- Threshold: Percent variance that triggers review.
- Within Policy: Variance at or below the threshold.
- Escalated: Sent to finance or risk for approval.
- AI Reason: AI's likely root cause for the variance.
- Materiality: Size of impact on totals or risk.
- Confidence: AI certainty in the reason or match.

## Executive Summary (/executive)
Status: Completed
Answers: Portfolio variance risk snapshot.
Next: Focus on cases needing review.
Key elements:
- Threshold and status filters
- KPI totals by status
- Policy check chart
- Variance distribution chart
- Root cause rollup
- Top variances table
Tooltips to add:
- Threshold: Percent variance that triggers review.
- Within Policy: Variance at or below the threshold.
- AI Reason: AI's likely root cause for the variance.
Empty states to add:
- No cases match these filters. Reset filters to see all cases.
Value cue: Cases above threshold need review.
Implemented:
- Added two-line header microcopy.
- Added threshold, policy, and AI Reason tooltips.
- Added filtered empty state with reset action.
- Added cases-above-threshold callout with Inbox link.
- Added quick focus buttons for open and escalated.
Remaining gaps:
- Add click-through from charts to filtered Inbox.
- Add materiality impact on totals.
Next tab to improve: Inbox

## Inbox (/inbox)
Status: Completed
Answers: Queue of cases to review.
Next: Pick next case to act.
Key elements:
- Filters for status and confidence
- Quick focus buttons
- High-confidence callout
- Case table with actions
- AI Reason preview
- Resettable empty state
Tooltips to add:
- Variance: Difference between expected and actual amount.
- Confidence: AI certainty in the match.
- AI Reason: AI's likely root cause for the variance.
Empty states to add:
- No cases found. Reset filters to see cases.
Value cue: High-confidence open cases can be resolved now.
Implemented:
- Added two-line header microcopy.
- Added quick focus buttons for open and escalated.
- Added high-confidence callout with one-click filter.
- Added AI Reason column and tooltip headers.
- Added resettable teaching empty state copy.
Remaining gaps:
- Add preview of variance drivers inline.
- Add bulk actions for quick resolve.
Next tab to improve: Case Detail

## Case Detail (/cases/:caseId)
Status: Completed
Answers: Single case story and evidence.
Next: Review, then accept or escalate.
Key elements:
- Transaction summary
- AI reason and variance
- Status and confidence
- Evidence tabs
- Conflict flags
- Action buttons
Tooltips to add:
- Variance: Difference between expected and actual amount.
- Confidence: AI certainty in the match.
- AI Reason: AI's likely root cause for the variance.
Empty states to add:
- No structured rows. Review evidence or run log.
- No conflicts detected. Review evidence, then accept.
Value cue: High confidence and no conflicts.
Implemented:
- Added two-line header microcopy.
- Added AI Reason row with tooltip.
- Added confidence and variance tooltips.
- Added quick-accept callout with action.
- Defaulted to Conflicts tab when present.
- Tightened empty state guidance.
Remaining gaps:
- Add summary of materiality impact.
- Add evidence drill-down shortcuts.
Next tab to improve: Resolved

## Resolved (/resolved)
Status: Completed
Answers: Closed cases and outcomes.
Next: Search and spot throughput.
Key elements:
- Recent resolved callout
- Quick search
- Resolution type
- Confidence badge
- Closed timestamp
- View case link
Tooltips to add:
- Resolution: How the case was closed.
- Closed at: Time the case was resolved.
Empty states to add:
- No resolved cases yet. Review cases in Inbox.
Value cue: Resolved in last 7 days.
Implemented:
- Added two-line header microcopy.
- Added quick search and recent toggle.
- Added recent resolved callout.
- Clarified resolution type.
- Added guided empty state with Inbox action.
Remaining gaps:
- Add export of resolved list.
- Add trend view by week.
Next tab to improve: Escalations

## Escalations (/escalations)
Status: Completed
Answers: Cases escalated for human review.
Next: Open packet, decide, close.
Key elements:
- Priority filters
- Escalation list
- Reviewer packet summary
- Packet includes list
- Case summary
- Close escalation action
Tooltips to add:
- Priority: Priority reflects risk and urgency.
Empty states to add:
- No escalations. Review cases in Inbox.
Value cue: Escalations waiting count.
Implemented:
- Added two-line header microcopy.
- Added priority filters and tooltip.
- Added waiting count callout.
- Defaulted to first packet when available.
- Added packet contents checklist.
Remaining gaps:
- Add bulk close option.
- Add SLA timer per packet.
Next tab to improve: Settings

## Settings (/settings)
Status: Completed
Answers: Control data sources and behavior.
Next: Use defaults unless testing.
Key elements:
- Provider selection
- Change notice callout
Tooltips to add:
- Data provider: Selects where case data comes from.
Empty states to add:
- None
Value cue: Changes apply across all tabs.
Implemented:
- Added two-line header microcopy.
- Added change notice callout.
- Added provider tooltip.
Remaining gaps:
- Add confirmation on provider change.
Next tab to improve: None
