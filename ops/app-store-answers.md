# App Store answers for Departure: Fitness Quest

What the App Store job told Apple, and why. Checked against the code in `qualia-fitness` on 2026-11-22.

## Why 1.0.4 could not be sent for review

Apple refused to add version 1.0.4 to the review submission. The associated error said the age rating declaration was missing a required answer: `socialMedia`. Apple added new questions to the age rating questionnaire, which is the "App Compliance" item in App Store Connect. Source: `ops/reports/app-store/last-diagnose.json`.

## Age rating declaration (set 2026-11-22)

| Question | Answer | Reason |
| --- | --- | --- |
| socialMedia | Yes | Players search for other users, join teams, and see a team workout feed with reactions and comments. |
| socialMediaAgeRestricted | No | The app does not check a player's age before these features. |
| sharedLocation | No | The app does not use or share location. No location module is in the code. |
| messagingAndChat | Yes (was No) | Teams have a chat (`app/team/[id]/chat.tsx`, table `team_messages`). |
| userGeneratedContent | Yes (was No) | Players write chat messages, comments, team names and post workouts that other players see. |

Answers already given and left as they were:

| Question | Answer | Note |
| --- | --- | --- |
| violenceCartoonOrFantasy | Frequent or intense | Monster battles are fantasy combat. Kept the earlier, higher answer. |
| violenceRealistic | Infrequent or mild | Earlier answer, kept. |
| gunsOrOtherWeapons | Infrequent or mild | Fantasy weapons as gear. |
| contests | Frequent or intense | Team battles and leaderboards. |
| lootBox | Yes | The Treasure Trail purchases give a chest with random gear after each kill. |
| healthOrWellnessTopics | Yes | Workout tracking and a weight goal projection. |
| advertising | No | The app shows no ads. The Meta SDK only measures installs. |
| gambling, gamblingSimulated | No, None | No betting or casino games. |
| alcohol, sexual content, nudity, profanity, horror, mature themes, medical information | None | Not in the app. |
| unrestrictedWebAccess, parentalControls, ageAssurance | No | None of these exist in the app. |
| Made for kids | No | The privacy policy says the app is not for children under 13. |

## Other review data (read, not changed)

- App Review contact: Kyle Becker, departure@engagequalia.com, phone on file.
- Demo account: required, `appreview@qualia.app`, password on file in App Store Connect. Not documented in `qualia-fitness`.
- Content rights: does not use third party content. Primary category: Health and Fitness.
- Available in 175 territories. Prices and in-app purchases were not touched.
