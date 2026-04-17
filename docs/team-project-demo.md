# Team Project Demo

This demo exercises the full team-project flow locally against the FileStore-backed API:

1. instructor creates a reusable project template
2. instructor creates a published team project from that template
3. three students apply for ranked roles
4. instructor generates suggested teams
5. instructor locks the generated teams
6. a team member submits once for the whole team
7. another teammate can view the same team submission

## Run It

```bash
npm run build
npm run demo:team-projects
```

## What You Should See

- a created template with `teamSize: 3`
- a created project with a cloned milestone from the template
- three role applications
- one generated team and an empty waitlist
- one locked team with three members and assigned roles
- one team submission with `teamId`, `teamName`, and `submittedByUserId`
- the same submission visible to another team member

## What It Proves

- templates are course-scoped and reusable
- project creation can start from a template
- students can apply for roles before teams are locked
- the matching flow produces a deterministic formation run
- locking teams assigns roles and provisions the team container record
- team submissions are stored once and shared across team members
