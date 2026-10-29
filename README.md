# Dawa Saathi

A static medicine organizer that can sync user accounts across devices using Supabase. GitHub Pages serves the HTML, CSS, and JavaScript. Supabase provides hosted authentication, the Postgres database, and private prescription PDF storage.

## Features

- Email/password accounts handled by Supabase Auth.
- Medicine batches, expiry dates, and medicine details saved per account and available after signing in on another device.
- Prescription capture/upload, PDF conversion, in-site viewing, download, rename, and replace.
- Private per-user PDF storage with row-level security policies.
- First-sign-in migration of matching local batches and prescription PDFs from this browser.

## Publish on GitHub Pages

1. Follow [SUPABASE-SETUP.md](SUPABASE-SETUP.md) to create the backend and configure `assets/supabase-config.js`.
2. Upload the project files to the root of a GitHub repository. Keep `index.html`, `assets/`, and `supabase-schema.sql` together.
3. In the repository, open **Settings → Pages**. Select **Deploy from a branch**, choose `main` and `/(root)`, then save.
4. Add the published Pages URL to Supabase Authentication's allowed redirect URLs.

The Pages URL is usually `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Data and privacy

Passwords are handled by Supabase Auth. Batches are stored in a user-scoped database row. Prescription PDFs are stored in a private bucket and accessed with short-lived signed links after sign-in. The SQL schema applies row-level security to user rows and storage paths. The browser config contains only a public publishable/anon key; never place a Supabase secret or service-role key in this repository.

This project is intended for testing. Prescription documents can contain sensitive health information; choose hosting, region, and retention settings accordingly.
