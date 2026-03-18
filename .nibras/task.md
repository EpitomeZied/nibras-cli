# Nibras Hosted CLI Migration

This repository now supports a project-local learner flow alongside the legacy
course CLI.

Use the new flow like this:

```bash
npm run build
npm run api:dev
nibras login
nibras whoami
nibras ping
nibras test
nibras task
nibras submit
```

Notes:

- `nibras` without positional arguments now shows a polished help screen.
- `nibras <subject> <command> <project>` still routes to the legacy CLI.
- `nibras setup --project cs161/exam1 --dir /tmp/my-project` bootstraps a local
  project manifest from the API.
