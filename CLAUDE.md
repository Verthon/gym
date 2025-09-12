# Claude AI Assistant Guidelines

This document outlines how I (Claude) work best with this TypeScript domain modeling project. These guidelines help me provide consistent, high-quality assistance while respecting the established patterns and architectural decisions.

> Context-aware AI assistance for robust domain-driven TypeScript development.

## My Capabilities & Approach

### Code Analysis & Understanding
- **Semantic Search**: I can search through your codebase semantically - ask me to find patterns, concepts, or related functionality
- **Pattern Recognition**: I understand DDD patterns (Entities, Value Objects, Aggregates) and can identify them in your code
- **Cross-file Dependencies**: I can trace relationships between files and understand how components interact

### Code Generation & Modification
- **Follows Existing Patterns**: I analyze your existing code style and patterns before making suggestions
- **Type-Safe Approach**: I prioritize TypeScript safety and leverage your strict tsconfig settings
- **Test-Driven**: I can generate tests following your Vitest patterns and test structure
- **Result Pattern**: I understand and will use your `Result<T, E>` pattern for error handling

## Working with Your Domain Model

### Value Objects
When creating or modifying Value Objects, I will:
- Use your factory pattern with `Result<T, Error>` return types
- Implement structural equality via `equals()` methods
- Make all properties `readonly` and use private constructors
- Follow your validation order (fail-fast, least to most expensive)
- Include comprehensive error types with context where appropriate

```typescript
// I'll follow this pattern from your PersonId
static create(input: string): Result<PersonId, PersonIdError> {
  if (!input) return err({ code: "EMPTY" });
  // ... validation logic
  return ok(new PersonId(value));
}
```

### Entities & Aggregates  
For entities, I will:
- Use your private field + public getter pattern
- Implement business logic in named methods that check invariants
- Generate domain events following your `events.mts` patterns
- Use typed IDs (following your `PersonId` approach)
- Maintain state transitions through explicit methods

### Domain Events
I understand your event patterns:
- Internal events use Value Objects and `LocalDate`
- Generic events use string dates for serialization
- Factory functions with default timestamps
- Adapter functions for converting between types

## Code Patterns I'll Follow

### File Organization
- **Barrel Exports**: I'll suggest proper index files when needed
- **Test Co-location**: Tests in `__tests__/` directories following your structure
- **Import Aliases**: Using your `@/*` path mapping consistently

### Error Handling
- **Result Pattern**: Always use `Result<T, E>` for operations that can fail
- **Typed Errors**: Create specific error union types with `code` and optional `context`
- **Early Returns**: Follow your fail-fast validation approach

### Testing Approach
- **Vitest Patterns**: Follow your existing test structure and naming
- **Behavior-Focused**: Test business behaviors, not just happy paths
- **Edge Cases**: Include validation edge cases and error scenarios

## My Workflow

### When You Ask Me To:

**"Analyze this code"**
- I'll read the file(s) and explain the domain concepts
- Identify patterns and architectural decisions  
- Point out potential improvements or inconsistencies

**"Add a new feature"**
- I'll first understand the existing domain model
- Create a plan that follows your established patterns
- Generate code with tests following your conventions
- Ensure type safety and proper error handling

**"Debug an issue"**
- I'll trace through your code logic
- Check for pattern violations or inconsistencies
- Suggest fixes that maintain your architectural integrity

**"Refactor code"**
- I'll preserve your domain model integrity
- Maintain backward compatibility where possible
- Update related tests and dependencies
- Follow your established coding patterns

## Quick Reference

### Commands I Respond Well To:
- `"Search for X pattern in the codebase"`
- `"Create a new Value Object for Y"`
- `"Add tests for the Z functionality"`
- `"Refactor this to follow the established patterns"`
- `"Explain how X relates to Y in the domain"`

### What I Need to Know:
- **Context**: What domain concept are you working with?
- **Scope**: Which files/areas should I focus on?
- **Requirements**: Any specific business rules or constraints?
- **Testing**: Do you want tests generated alongside code?

## Domain Understanding

I understand this is a **gym contracting system** implementing concepts from "Understand Your Domain First". Key domains I'm aware of:

- **Contracting**: Contract drafts, signatures, validation rules
- **Money**: Fee structures, different fee types, monetary calculations  
- **Identity**: Person identification, government IDs, guardianship
- **Events**: Domain event publishing and handling
- **Time**: Local date handling and age calculations

## One-Line Refresher

```
Claude = semantic understanding + pattern following + type safety + domain awareness.
```
