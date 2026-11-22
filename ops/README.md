# Ops jobs

GitHub Actions jobs that let Claude run the iOS app "Departure: Fitness Quest" without opening App Store Connect or Expo.
Claude cannot start workflows by hand or read Actions logs, so every job starts from a push or a schedule and commits its result where Claude can read it.

## App Store listing and reviews (this repo)

Workflow: `.github/workflows/app-store-daily.yml`, script: `scripts/app-store.cjs`.

- Runs every day at 11:17 UTC (only from `main`) and on any push that changes `ops/requests/app-store/**`.
- Writes `ops/reports/app-store/latest.json` and a dated copy `YYYY-MM-DD.json`: app info, versions with their state, the live, pending and editable version, version localizations (description, keywords, promotional text, what's new), app info localizations (name, subtitle), the star rating from the public iTunes lookup, and the latest 50 customer reviews.
- Each report has `ok` and `errors`. Read `errors` before trusting the rest.

To change the listing, commit `ops/requests/app-store/listing.json` and push:

```json
{
  "locale": "en-US",
  "subtitle": "...",
  "keywords": "comma,separated,keywords",
  "promotionalText": "...",
  "description": "...",
  "whatsNew": "..."
}
```

Only the fields present are changed. Then pull and read `ops/reports/app-store/last-apply.json`: `changes` holds before and after for each change, `skipped` says what could not be applied and why, `errors` holds API errors.

Rules Apple applies:

- Description, keywords and what's new change only on a version that is still editable (prepare for submission or rejected). With no such version these fields are skipped and the report says so.
- Promotional text can change on the live version at any time.
- Subtitle lives on the app info and changes only while a new version is in preparation.

The job deletes `listing.json` in the same commit once it has tried it. If it could not read the current state from Apple, it keeps the file and retries on the next run.

The job never touches pricing, availability or in-app purchases.

## iOS release (qualia-fitness repo)

Workflow: `qualia-fitness/.github/workflows/release-ios.yml`.

1. Set `expo.version` in `app.json` to the new version (it must be higher than the live one) and commit.
2. Tag that commit `ios-vX.Y.Z` with the same version and push the tag: `git tag ios-v1.0.4 && git push origin ios-v1.0.4`.
3. The job checks that the tag matches `app.json`, builds on EAS with the `production` profile (EAS raises the build number), then submits the build to App Store Connect.
4. Fetch the branch `ops/ios-reports` and read `reports/<tag>.json` (`steps` says which step passed) and `logs/<tag>-build.log`, `logs/<tag>-submit.log`. A build takes about 15 to 40 minutes.

Submitting uploads the build to App Store Connect. Sending it for review is still a step in App Store Connect, or a later job.

## Secrets

Both repos hold `ASC_KEY_P8`, `ASC_KEY_ID` and `EXPO_TOKEN`. The issuer ID is in each workflow's `env`, it is not secret. The key file is written to the runner's temp folder and never committed.
