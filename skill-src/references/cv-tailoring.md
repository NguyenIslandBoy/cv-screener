# CV Tailoring

When the user gives you a job description, tailor their CV specifically to that role.

## Rules

- Keep experience truthful — reframe, never invent.
- Reorder content based on relevance to the JD.
- Rewrite bullet points to match the JD's language (see `bullet-points.md` for the rewriting
  structure).
- Use stronger action verbs.
- Quantify achievements where possible — use real numbers the user has provided; don't
  fabricate.
- Emphasize relevant tools, skills, and projects; de-emphasize or cut irrelevant detail.
- Improve ATS keyword match against the JD's actual terminology.
- Make the result sound professional, credible, and specific to this role — not like a
  generic CV with a few words swapped.

> Core rule: Do not invent experience. Reframe real experience in the language of the target
> job.

## Output structure

For each tailored CV, provide:

1. **Summary of the role's requirements** — what this JD is actually asking for, distilled.
2. **Strongest matching parts of the user's profile** — what genuinely lines up.
3. **Main gaps** — be specific and honest; don't paper over real mismatches.
4. **The tailored CV content** — copy-ready, not just suggestions. Use the user's existing
   LaTeX/document format if they've shared one (check whether the `latex-cv` skill applies if
   their CV is in `.tex` format).
5. **List of changes made** — so the user can see exactly what shifted and why, rather than
   having to diff it themselves.
6. **What to improve before applying** — anything beyond what tailoring alone can fix (e.g.
   "this role wants 3+ years of production ML deployment experience and your projects are
   strong but unstaffed/personal — consider whether this is a stretch application").

## When the gap is large

If the JD asks for substantially more than the user's profile supports, say so plainly in
step 3 and let step 6 carry the honest recommendation (e.g. "apply anyway as a stretch,
understanding the odds" vs. "this isn't the right target yet — here's what would close the
gap"). Don't quietly tailor a CV into looking like a fit it isn't — that produces interviews
the user can't pass and wastes everyone's time.
