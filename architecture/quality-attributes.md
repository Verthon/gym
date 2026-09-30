# Quality attributes

Purpose: a learning and showcase project for DDD, with an LLM-friendly API boilerplate that other API projects can reuse.

The ranking settles conflicts. A higher attribute wins over a lower one.

| # | Attribute | What it means | Measure |
|---|---|---|---|
| 1 | Agent guardrails | A weaker coder model cannot get wrong code past the gates. | Every agent failure pattern in `docs/tasks/agy-findings.md` has a gate that blocks it, not only a prose rule. |
| 2 | Agent efficiency | Any agent works in this repo without micro-management. | The agent finishes a scoped task with 0 corrective prompts. |
| 3 | Reusability | Agents reuse the patterns through CLI generators, not hand-written boilerplate. Experiment. | Every recurring building block (value object, entity, repository, spec) has a CLI generator, and agents use it. |
