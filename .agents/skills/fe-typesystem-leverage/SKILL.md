---
name: fe-typesystem-leverage
disable-model-invocation: true
description: "Use when the conversation involves decisions about how hard to lean on the TypeScript type system and where: whether same-shaped types should be blocked from mixing (branding, value objects), how domain concepts get modeled in types (IDs, money, units as primitives vs named types), where type-level enforcement should live, and what the compiler can and cannot be trusted to catch. Applies even when the user doesn't say 'branded types' or 'nominal typing' by name. Not for tsconfig setup."
---
## Structural typing: same shape ≠ same thing

TS compatibility is by shape, not by name. `UserId` and `OrderId` as
`string` aren't two types — they're one, and no amount of aliasing
changes that: an alias names an existing shape, it doesn't introduce a
new one.

Coming from a nominal language, the confusion runs inverse — excess
property checks on object literals look like nominal typing, but they
are a literal-assignment check that doesn't generalize.

The compiler passing means shape checked out, not meaning. złotówki²
compiles.

### Cutting question

**question:** Do two same-shaped types ever cross paths in one signature
or collection, and would mixing them be a domain error?
**cuts:** the answer comes from the domain and the call graph, not from
the types. Two failure states sit either side of it — primitive
obsession, where a load-bearing domain concept (money, id, unit) is
modeled as a bare primitive across hundreds of sites, so the compiler
blesses domain nonsense and the concept has no single home; and
brand-everything, where every string is branded "for safety", charging a
cast tax at every boundary and normalizing `as`, which erodes the seam.

Under-brand → silent cross-domain assignment, surfaces in prod, grep
can't find it because the types lied. Over-brand → every team pays
assignment ceremony forever for collisions that can't occur.

Once the answer is "yes, and the mix-up is costly", the live axis is
enforcement placement: a brand/opaque type is compile-time only with
zero runtime cost, a value object is a runtime construct that can carry
validation and behavior and is charged for it. A brand ends at its
`as`: a wrong unit or a raw `req.params.id` passes the cast and
comes out branded. It moves the mistake to the cast site and does not
remove it. Ask where that cast lives.
