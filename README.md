# Dawa Saathi — GitHub Pages

A static medicine organizer made with HTML, CSS, and JavaScript. It needs no backend, database, build step, or third-party PDF library.

## Features

- Local profile lock with an email and passphrase.
- Medicine batch and medicine detail tracking, including expiry warnings.
- Search across batch and medicine names, with JSON export for medicine-list backup.
- Prescription library: take a photo with a phone camera, choose an image from storage, or import an existing PDF. Preview and name the file before saving; images are converted to PDF in the browser. View, download, or delete saved PDFs.
- Data is kept in browser storage on the current device.

## Publish

1. Create a GitHub repository and upload the project files to its root. Keep `index.html` beside the `assets/` folder.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for the deployment. GitHub shows the published URL in Pages settings.

The URL is usually `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Local storage and privacy

This profile screen is a local lock, not secure online authentication. Profile data and the password verifier are stored in browser storage, while prescription PDFs are stored in IndexedDB. Anyone with access to the same browser profile may be able to access local data. There is no account recovery, server backup, or cross-device sync. Use **Export backup** for the medicine list and download prescription PDFs individually to keep backups.

Avoid entering information you do not want stored in this browser. Follow a clinician's or pharmacist's directions for medication decisions.
