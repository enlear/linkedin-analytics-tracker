# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through
[GitHub's vulnerability reporting](https://github.com/enlear/linkedin-analytics-tracker/security/advisories/new).
We aim to reply within a week.

The most important classes of bug for this project are:

- **Personal version:** anything that could send a user's export data off their device, such as
  a Content-Security-Policy bypass or a dependency that phones home.
- **Team version:** anything that lets one person see or change data they shouldn't. Examples are
  a member reading or editing another member's data, a member reaching company analytics or the
  Meta access token, a way to become admin without the database owner, or the app needing
  Supabase's secret key.

## Running the team version safely

- Only put the **publishable** Supabase key in the app and your host. Never the secret or
  `service_role` key.
- Don't turn off email confirmation on a publicly known address. If you do, close sign-ups once
  your team has joined.
- Keep the keep-alive values as repository *variables*. They are public values; never store
  secret keys in this repository.

## Never share real exports

LinkedIn exports contain personal data. Don't attach them to issues or pull requests, even "just
the numbers". Describe the structure instead: sheet names, column headers and date format.
