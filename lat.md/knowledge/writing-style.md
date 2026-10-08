# Writing style

These writing guidelines apply only to `lat.md/docs/`. They help readers understand Lat and complete tasks, rather than narrating the implementation or prescribing how technical knowledge is written.

[[knowledge]] serves a different purpose: dry, precise architecture, constraints, decisions, and test intent alongside the code. Its existing [Lat authoring skill](../../templates/skill/SKILL.md) remains the guide for maintaining that material. Both kinds of content still follow Lat's structural and link-validation rules.

The editorial principles draw on [Vercel's design guide](https://vercel.com/design.md), without adopting its branding, component system, or blanket stylistic prohibitions.

Lead with what a feature enables and why it matters, then show the shortest useful path to using it.

Answer practical questions: which option should I choose, what should I run, and what happens next? Explain implementation details only when they affect the user's decision or expectations. Link to knowledge for deeper rationale and exact contracts.

Each page and section should answer a distinct question; link to established explanations instead of repeating them.

[[quick-start]] owns setup, the bootstrap prompt, and the initial workflow. Feature guides explain specific tasks; [[commands]] supports CLI lookup. Avoid repeating the same introduction, summary, and conclusion under different headings.

Use concrete nouns, active verbs, sentence-case headings, and consistent terminology without weakening the meaning.

Define unfamiliar terms before relying on them: a vault is the project's `lat.md/` directory. Keep paragraphs short and cohesive. Remove ceremony and hype, not necessary qualifications.

For example, `lat check` validates documented links, structure, and code references; it does not prove that the prose correctly describes application behavior. Performance claims need their measurement conditions, not unsupported adjectives.

Show commands and examples that readers can copy, with enough context to understand their effect and expected result.

Use backticks for commands, paths, and identifiers, and language-tagged fences for snippets. Put prerequisites and meaningful caveats beside the affected step. Separate concise guidance from detailed reference material, and make the next action clear.

Prefer prose for explanations, lists for steps or choices, and tables for comparisons or lookup. Add a diagram only when it explains a relationship more clearly than text. Keep the document readable without decorative cards, icons, or color.
