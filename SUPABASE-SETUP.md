# Enable accounts and cross-device sync

GitHub Pages hosts the website files only. Supabase provides account sign-in, the database, and private prescription-file storage.

## 1. Create and configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, open `supabase-schema.sql` from this project, paste it, and run it. It creates the user-owned data tables, private PDF bucket, and row-level security rules.
3. In **Project Settings → API Keys**, copy the project URL and the **publishable key** (or legacy `anon` key). Never use a `secret` or `service_role` key in this website.
4. Open `assets/supabase-config.js` and fill in `url` and `publishableKey`.
5. In **Authentication → URL Configuration**, add your GitHub Pages address to the allowed redirect URLs. For a repository site, it looks like `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`.
6. In **Authentication → Providers → Email**, enable email/password sign-in. Email confirmation may be enabled; new users then confirm their email before signing in.
7. Upload/commit the updated project to GitHub Pages and open the Pages URL over HTTPS.

After setup, create an account in the website. The same account can sign in on another device to load its medicine batches and prescriptions. When an account first signs in on a browser with old local data for the same email, the app attempts to migrate that browser's batches and prescription PDFs to the account.

## What is stored

- Supabase Auth handles passwords; this app does not save password hashes itself.
- Medicine batches and medicine details are stored in the `user_data` table, scoped to the signed-in user.
- Prescription PDFs are stored in the private `prescriptions` Storage bucket. The `prescriptions` table stores their names and file paths. The app creates short-lived signed links only after the owner signs in.
- RLS policies in `supabase-schema.sql` restrict each account to its own rows and folder.

This is a testing project. Prescription records can contain sensitive health information. Choose a Supabase project/region and retention settings appropriate for your use; do not publish a service-role/secret key.
