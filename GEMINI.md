# Domain Modeling Guidelines

This document outlines the rules and patterns for creating domain model classes (Aggregates, Value Objects) within this project. The goal is to ensure that our domain model is robust, expressive, and always in a consistent state.

These guidelines are inspired by and aligned with the patterns in the [DomainDrivers/dd-typescript](https://github.com/DomainDrivers/dd-typescript) repository.

---

## Core Philosophy

1. **Protect Invariants at All Times**: An object, especially an Aggregate, must not exist in an invalid state. Validation is not an optional step; it is integral to an object's lifecycle.
2. **Model the Ubiquitous Language**: Class and method names should reflect the language used by domain experts. The code should read like a description of the business process.
3. **Fail Fast and Explicitly**: Business rule violations are predictable failures, not exceptional events. We handle them by returning a `Result` object, forcing the calling code to handle the outcome. We do not throw exceptions for business validation.

---

## 1. Aggregates

An Aggregate is a cluster of domain objects (Entities and Value Objects) that can be treated as a single unit.

### Rules for Aggregates

* **Private Constructor**: The constructor must be `private`. This prevents direct, uncontrolled instantiation.
* **Static Factory Method**: Aggregates must be created via a `public static` factory method (e.g., `create()`, `prepare()`, `initiate()`). This method is the sole entry point for creating a valid instance.
* **Upfront, Atomic Validation**: The static factory method is responsible for enforcing all business rules (invariants). It must receive all required data, validate it, and only if all rules pass, create and return the new instance.
* **Result-Oriented Return**: The factory method must return a `Result` type (e.g., `{ success: true; value: T } | { success: false; error: string }`). This makes success and failure explicit.
* **Immutability First**: Properties should be `readonly` by default. State changes should be handled by explicit behavior methods.
* **Explicit Behavior Methods**: Any change to an Aggregate's state must occur through a well-named public method (e.g., `signContract()`, `cancelSubscription()`). These methods contain the logic and validation for that specific state transition. Avoid public setters.

### Aggregate Skeleton

```typescript
type CreateAggregateProps = { /* raw data for creation */ };

class MyAggregate {
    // Properties are readonly and encapsulate Value Objects
    private readonly id: AggregateId;
    private readonly someValueObject: SomeValueObject;

    // Constructor is private
    private constructor(props: { id: AggregateId, someValueObject: SomeValueObject }) {
        this.id = props.id;
        this.someValueObject = props.someValueObject;
    }

    // Static factory for controlled creation and validation
    public static create(props: CreateAggregateProps): { success: true; value: MyAggregate } | { success: false; error: string } {
        // 1. Validate and create Value Objects first
        const voResult = SomeValueObject.create({ value: props.someValue });
        if (!voResult.success) {
            return voResult;
        }

        // 2. Validate aggregate-level business rules
        if (/* some aggregate rule is violated */) {
            return { success: false, error: 'Aggregate rule violation message.' };
        }

        // 3. Create and return the valid aggregate
        const aggregate = new MyAggregate({ id: new AggregateId(), someValueObject: voResult.value });
        return { success: true, value: aggregate };
    }

    // Behavior method that enforces invariants for a state change
    public doSomething(): { success: true } | { success: false; error: string } {
        if (/* check if this action is currently allowed */) {
            // Mutate internal state
            // this.status = 'SomethingDone';
            return { success: true };
        }
        return { success: false, error: 'Cannot perform this action right now.' };
    }
}
```

---

## 2. Value Objects (VOs)

A Value Object is an immutable object that represents a descriptive aspect of the domain. It is defined by its attributes, not a unique identity.

### Rules for Value Objects

* **Immutability**: A VO must be immutable. All its properties must be `readonly`.
* **Self-Validation**: A VO is responsible for its own validity. It should not be possible to create an invalid VO.
* **Private Constructor & Static Factory**: Like Aggregates, VOs must have a `private constructor` and be created via a `public static create()` method that performs validation.
* **Structural Equality**: Two VOs are considered equal if all their attributes are equal. If needed, provide an `equals()` method to check for this.

### Value Object Skeleton

```typescript
type MyValueObjectProps = {
    value: string;
};

class MyValueObject {
    public readonly value: string;

    // Constructor is private
    private constructor(props: MyValueObjectProps) {
        this.value = props.value;
    }

    // Static factory for self-validation
    public static create(props: MyValueObjectProps): { success: true; value: MyValueObject } | { success: false; error: string } {
        if (!props.value || props.value.length < 3) {
            return { success: false, error: 'Value must be at least 3 characters long.' };
        }
        return { success: true, value: new MyValueObject(props) };
    }

    // Optional: Implement for structural equality checks
    public equals(other?: MyValueObject): boolean {
        return !!other && this.value === other.value;
    }
}
```
