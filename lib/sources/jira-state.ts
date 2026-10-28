// Jira reports a category for every status, so only one fact needs a label
// match: the resolutions that end an issue without finishing it. Jira files
// them under done like any other finished state, so the category alone would
// give "Won't Do" the same green check as "Done". Pure: used by client code.
export const JIRA_GONE_PATTERN = /won'?t\s*(do|fix)|cancel|reject|declin|duplicate|obsolete|invalid/i;
