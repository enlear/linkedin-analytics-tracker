# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through
[GitHub's vulnerability reporting](https://github.com/enlear/linkedin-analytics-tracker/security/advisories/new).
We aim to reply within a week.

The most important class of bug for this project is anything that could send a user's export
data off their device, such as a Content-Security-Policy bypass or a dependency that phones home.

## Never share real exports

LinkedIn exports contain personal data. Don't attach them to issues or pull requests, even "just
the numbers". Describe the structure instead: sheet names, column headers and date format.
