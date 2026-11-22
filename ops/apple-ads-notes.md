# Apple Ads: notes across sessions

Last updated 2026-11-22.

## Status

Nothing is done yet. Both tasks below were tried from a cloud session on 2026-11-22 and were blocked:

- The cloud session had no built-in browser, so it could not open Apple Ads.
- Kyle's Mac (Kyles-MacBook-Pro) lists the folders `Qualia`, `WorkoutApp` and `asset-living-transitions` in Remote Control, but offers none of them to cloud sessions. The usual cause is a Claude desktop app that needs an update.
- No Apple Ads change was made. No key was created. No GitHub secret was stored. No app code was pushed.

Next step: Kyle runs the prompt below in a **local** session of the Claude desktop app on his Mac.

## What we know

- Apple Ads **Basic** account exists for "Departure: Fitness Quest" (App Store id 6761634387). Created Apr 25 2026, $3 max cost per install, $300 monthly budget, 0 installs.
- Every attempt to reach **Advanced** (the "Basic ▾" menu, ads.apple.com "Get started") sent Kyle back to the Basic dashboard.
- The goal is an Advanced account on the same Apple ID with API access, so a cloud session can manage ads.
- Once done, `ops/apple-ads.json` in this repo holds `clientId`, `teamId`, `keyId`, `orgId`, `createdAt` (not secret). The private key lives in the GitHub secret `APPLE_ADS_PRIVATE_KEY` and in `~/.apple-ads/` on Kyle's Mac only.
- Separate problem: github.com/kjbecker85/qualia-fitness main has app.json version 1.0.0 and no app commit after 2026-04-20, while the App Store has 1.0.3 live. Kyle's local app folder has the newer code and never reached GitHub.

## Prompt for a local session on Kyle's Mac

```text
You are running locally on Kyle's Mac in the Claude desktop app. Kyle wants his Apple Ads managed with as little involvement from him as possible. He hates GitHub chores and long instructions. Do the clicking yourself in the built-in browser: load the `anthropic-skills:built-in-browser` skill first, then use the Claude_Browser tools. Hand control to Kyle only for his Apple ID password, 2FA codes and payment details. Keep messages to him short. Never ask him to paste a key or password into the chat.

If you find you are actually in a cloud container (no ~/ Mac home folder, no built-in browser tools), stop and tell Kyle in one line.

## Task 1: Apple Ads Advanced

Kyle has an Apple Ads Basic account (app-ads.apple.com/cm/basic/app/dashboard) for the iOS app "Departure: Fitness Quest" (App Store id 6761634387): created Apr 25 2026, $3 max cost per install, $300 monthly budget, 0 installs. Every attempt to reach Advanced (the "Basic ▾" menu, the ads.apple.com "Get started" button) sent him back to the Basic dashboard.

Goal: an Apple Ads Advanced account on the same Apple ID, with API access.
1. In the built-in browser, try app-ads.apple.com/cm/app. Then try the Apple Ads logo or the "Basic ▾" switcher at the top left. Then try ads.apple.com/app-store, "Sign In", then "Advanced". Read Apple's help page "Switch Apple Ads solutions" (ads.apple.com/app-store/help/apple-ads-basic/0069-switch-apple-ads-solutions) with get_page_text and follow it. If it requires a new Advanced account or campaign group on the same Apple ID, create it. Use currency USD and time zone America/Chicago. Both are permanent. Do NOT create a campaign. Do NOT change the Basic campaign.
2. If Apple will not allow Advanced for this account, stop, tell Kyle in two sentences, and go to Task 2.
3. In Advanced, open the account name menu, then Account Settings, then API. Apple asks for a public key. Make the key pair in the terminal:
   cd ~ && mkdir -p .apple-ads && cd .apple-ads && openssl ecparam -genkey -name prime256v1 -noout -out private-key.pem && openssl ec -in private-key.pem -pubout -out public-key.pem
   Read public-key.pem and type its contents into Apple's form (the public key is not secret), then save. Apple then shows clientId, teamId and keyId.
4. Store the private key as a GitHub Actions secret without printing it:
   gh secret set APPLE_ADS_PRIVATE_KEY -R kjbecker85/Departure-Website < ~/.apple-ads/private-key.pem
   If gh is missing or not logged in, run `pbcopy < ~/.apple-ads/private-key.pem`, open github.com/kjbecker85/Departure-Website/settings/secrets/actions/new in the built-in browser, and have Kyle paste it.
5. Note the Advanced orgId (it is in the account menu or the URL).
6. Commit the IDs that are not secret so the cloud session can read them. Clone github.com/kjbecker85/Departure-Website or use a local checkout. Add ops/apple-ads.json with {"clientId","teamId","keyId","orgId","createdAt"}. Update the Status section of ops/apple-ads-notes.md. Commit to main with the message "Record Apple Ads API ids (not secret)" and push.

## Task 2: push the Departure app code

The App Store has Departure versions 1.0, 1.0.1, 1.0.2 and 1.0.3 live (1.0.3 released 2026-04-27). But github.com/kjbecker85/qualia-fitness main has app.json version 1.0.0, and its newest app commit is from 2026-04-20. Kyle tried to push his local copy once and nothing arrived.

Find his local Departure app folder: an Expo app, bundle id com.qualia.fitness, package name probably qualia-fitness. Look under ~/ and in folders like "10 Work/Qualia" and "WorkoutApp". Ask Kyle only if you cannot find it.

Report `git remote -v`, `git status`, `git log -5 --oneline` and the version in app.json. Then:
- commit any uncommitted work,
- fetch origin and merge origin/main into it. origin/main has new commits from Claude: analytics in lib/analytics.ts, a waitlist coin migration and a release workflow. Keep both sides and resolve conflicts carefully.
- run `npx tsc --noEmit` and make sure no new errors appear,
- push to main. Never force push.
If the folder's remote is a different repository, tell Kyle which one and stop before pushing.

## Finish

Tell Kyle in at most five short lines what was done and what is still blocked. He will pass it to the cloud session.
```
