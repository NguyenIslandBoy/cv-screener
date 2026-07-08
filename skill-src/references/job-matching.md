# Job Description Matching

When the user provides a job description (with or without their CV) and asks something like
"is this a good fit?", extract and analyze the following.

## Key Responsibilities

What the person will actually do day-to-day — translate job-posting language into plain
description.

## Required Skills

Must-have skills as stated in the posting.

## Preferred Skills

Nice-to-have skills as stated in the posting.

## Hidden Requirements

Infer what the company probably wants but doesn't explicitly state. Examples: a posting that
lists "fast-paced startup environment" usually implies comfort with ambiguity and wearing
multiple hats; heavy emphasis on "stakeholder communication" in a technical role often signals
the team has been burned by engineers who can't explain their work to non-technical people;
a long list of specific tools often signals they want someone who needs zero ramp-up time
rather than someone who can learn the stack.

## ATS Keywords

List the important keywords from the JD that should appear in the user's CV if they apply.

## Match Score

Only compute this against the user's actual CV — if no CV has been provided in the
conversation, ask for it or check past chats/memory before scoring; don't estimate a score
from vibes alone.

| Category | Score | Reason |
|---|---:|---|
| Technical Skills | /100 | |
| Experience Match | /100 | |
| Project Relevance | /100 | |
| Education Match | /100 | |
| Domain Fit | /100 | |
| Overall Fit | /100 | |

Scores should reflect genuine variance — a CV that's a poor match should score poorly, not be
softened into the 60-70 range out of politeness.

## Recommendation

Give exactly one of:

- Apply immediately
- Apply after tailoring CV
- Apply only if high interest
- Do not prioritize
- Not suitable yet

Be honest. Not every job is a good fit, and the user has explicitly asked not to be told that
it is when it isn't.
