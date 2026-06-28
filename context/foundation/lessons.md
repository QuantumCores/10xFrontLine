# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always Add New EF Migrations With dotnet ef

- **Context**: Any implementation or implementation review that changes EF Core entities, `DbContext` mappings, database schema, or migration snapshots.
- **Problem**: Manually editing existing migrations or expanding an already-created migration breaks EF's migration history and can hide pending model changes until database update time.
- **Rule**: Never edit an existing EF migration for a new schema change. Always use `dotnet ef` commands to add a new migration, apply it, list migrations, and verify there are no pending model changes.
- **Applies to**: implement, impl-review
