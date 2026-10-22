---
name: csharp-unit-test
description: Write and run xUnit unit tests for this repo's .NET 10 services (Web, Catalog, Ordering, Gateway). Use for every new feature: where the test project goes, what to extract so logic is testable, which cases to cover, and the mandatory QA report.
---

# C# unit tests (xUnit) — project conventions

Replaces the external `csharp-unit-test` skill, whose source repo is unreachable.

## Where
- Test projects live under `src/` as `src/<Project>.Tests` (e.g. `src/ECommerce.Web.Tests`). There is no solution file: run `dotnet test src/<Project>.Tests`.
- Never reference a test project from `ECommerce.AppHost`, and never add it to deployment (Dockerfiles copy only their own project + ServiceDefaults).
- Csproj: `net10.0`, `Nullable`/`ImplicitUsings` enabled, `IsPackable=false`, packages `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, one `ProjectReference` to the project under test. Reuse `src/ECommerce.Web.Tests/ECommerce.Web.Tests.csproj` as the template.

## Make logic testable
- Pull pure logic out of Razor components / endpoint lambdas into a static or injectable class (e.g. `Services/ProductFilter.cs`). Test that class; do not try to unit-test `.razor` markup.
- No HTTP, DB or clock inside the unit under test; pass them in. For EF Core use the InMemory provider, for HTTP clients a fake `HttpMessageHandler`.

## Cases to cover for every feature
- Happy path, plus each acceptance criterion as its own test.
- null / empty / whitespace input; trimming.
- Case-insensitivity and culture safety when strings are compared (`StringComparison.OrdinalIgnoreCase`).
- Nullable members (e.g. `Description` can be null).
- No match / not found; empty collections.
- Special characters (`% < ' <b> [ .*`) are treated literally and never throw; very long input.
- Inputs are not mutated; results are stable (ordering).
- Error paths from the acceptance criteria (validation failure, upstream 404/500 for Ordering -> Catalog).
- Use `[Theory]`/`[InlineData]` for input tables. Name tests `Method_Condition_Expected`.

## Rules
- QA writes tests only; never edit production code to make a test pass — report `FAIL` for `migration`.
- No tautological assertions (`Assert.True(true)`, asserting a value you just set). Do not count them.
- Run `dotnet test` and report real counts; if it cannot run, say so, never claim PASS.

## Report (consumed by `/orchestrate`)
```
QA RESULT: PASS | FAIL
Unit: <n passed / n failed>   E2E: <n passed / n failed>
Failures:
1. <test name> — <assertion/error, trimmed> — <likely cause>
```
PASS means 100%. List what was not tested.
