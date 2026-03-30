@AGENTS.md

## Testing requirements

Every new feature must include:
- **Unit tests** for all new functions, components, and utilities
- **Integration tests** where possible (e.g., API routes, database interactions, multi-component flows)

Tests should be written alongside the feature code, not as an afterthought.

## Accounts migration

An accounts migration plan exists at `/docs/accounts-migration-plan.md`. When building new features that touch authentication, members, sessions, or authorization:
- Review the migration plan to ensure new code is forward-compatible with the accounts model
- Prefer patterns that will survive the member → membership rename (e.g., avoid hardcoding "member" in new abstractions)
- New auth-related features should consider the dual-auth phase where both session tokens and account sessions coexist
- Role-based access control (admin/member/viewer) is planned — avoid building permission logic that contradicts the planned RBAC model
