# Error handling strategy

For error handling there is a convention of having result return type:

- either success
- or failure

By convention the failure is on the left side, the success on the right side.

Advantages:

- testability, it is easier to test
- flow of the runtime is linear
- readability, directly on the IDE you can see the outputs
- doesn't require additional try/catch blocks on the caller

Tradeoffs:

- if someone is used to exceptions it will take some time to adjust
- additional handling on the caller

## Comparison with Exceptions

Throwing error seems natural but it has tradeoffs:

- if not handled properly can sneak to the clients, exposing details (security driver)
- flow of the runtime is not linear
- hard to know if the method is actually throwing the error on IDE level (readability driver)
- require additional try/catch blocks on the caller
