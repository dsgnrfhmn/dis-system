# PRINCIPLES.md

## Rational Brutalism

This design system exists to serve function and the user's goal — not to
decorate, brand, or evoke emotion. Every visual decision is judged against one
question: **does this help the user understand or do something faster and more
clearly?** If the answer is no, or "it just looks nice," it doesn't belong.

### What this means in practice

- **No decoration without function.** Gradients, shadows, animation, rounded
  corners, color — each must justify itself functionally (state, hierarchy,
  affordance, feedback). "It looks more polished" is not a justification.
- **Color is a signal, not a mood.** Use color to communicate state (error,
  success, active, disabled) or hierarchy (primary vs secondary action).
  Don't use color to feel "friendly" or "on-brand."
- **Typography follows information hierarchy, not personality.** Size and
  weight communicate importance and structure, not tone.
- **Motion only for feedback or continuity.** Animation confirms an action
  happened or orients the user during a state change. Never for delight.
- **Density over whitespace-as-aesthetic.** Give elements the space they need
  to be legible and separable — not more, for a "premium" feel.
- **Consistency over novelty.** A new component should look like it belongs
  next to existing ones. Distinctiveness is not a design goal here.

### What this does not mean

- Not "ugly on purpose." Rational brutalism is not anti-aesthetic — clarity
  and good proportion are still required. It rejects emotional/decorative
  intent, not visual quality.
- Not minimalism-as-branding either. Minimalism chosen to *look* minimal is
  still decoration. The test is always function, not a style label.

### How to apply this when building a component

Before finalizing any component, answer in its `meta.json` `rationale` field:
*why does it look the way it does, functionally?* If the honest answer is
"because it looks better this way," reconsider the choice.

### Audience note

Users of this system are technical: developers, DevOps, engineers, and other
technical products' users. They are task-focused and impatient with friction.
Rational brutalism serves them directly — it is not a stylistic constraint
imposed from outside, it's what this audience actually needs.
