# AI Agent Instructions

## Backend Testing

Whenever you write new unit tests in the backend, remember to manually import and use `jest.mock('@src/services/db.service', () => require('@src/test/db.mock'))` to avoid attempting real database connections. Run integration tests normally by spinning up the local test docker container!

## Git and Commits

NEVER use `git push --no-verify`. Always run tests locally or allow husky hooks to run properly to prevent spurious changes from being pushed. If tests fail, fix them before pushing.
