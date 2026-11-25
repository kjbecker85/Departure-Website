# Discord server setup: Departure: Fitness Quest

Updated 2026-11-25, when the server was restarted. The setup is a script, not clicks:
`scripts/discord-setup.mjs` in `kjbecker85/qualia-apps-ops` reads the same layout as this page and
builds it through Discord's API with a bot that has the Administrator permission. It is safe to run
again: it adds what is missing, fixes topics and locks, and edits its own posts in place.

```
DISCORD_BOT_TOKEN=... node scripts/discord-setup.mjs <guild id> --dry-run   # print the plan
DISCORD_BOT_TOKEN=... node scripts/discord-setup.mjs <guild id> --webhook   # make it, print the invite and the webhook
```

Facts the posts rely on (checked against `qualia-fitness`): iPhone only on the App Store
(https://apps.apple.com/app/id6761634387); 24 ranks from Recruit to Legend (`constants/ranks.ts`);
24 monsters in six groups, Goblin Horde to Titan Pantheon, with tougher versions after a group is
cleared (`constants/journey.ts`); teams of up to 8; Monster Ambush; scoring rules in the app under
How Scoring Works. X and TikTok are dropped: never link them.

## Channels

### WELCOME
- `#rules`: server rules, read-only for @everyone, pinned post
- `#announcements`: news, read-only for @everyone, pinned relaunch welcome. The social job's webhook (`DISCORD_WEBHOOK_URL`) posts here
- `#introductions`: "Post your rank and your team name". Discord's join messages go here

### GENERAL
- `#chat`
- `#feedback-and-bugs`
- `#feature-requests`: react to vote

### THE JOURNEY
- `#monster-kills`: boss fights and Monster Ambush results
- `#pr-celebrations`
- `#team-recruitment`: a team holds up to 8 players
- `#loot-drops`

### DEV LOG
- `#changelog`: read-only for @everyone
- `#roadmap`
- `#polls`

## Rules (posted and pinned in #rules)

```
1. Be kind. Everyone here is training to get stronger, at every level.
2. No spam, no ads, no selling.
3. Bugs and app feedback go in #feedback-and-bugs. Ideas go in #feature-requests.
4. Share your wins: personal records, rank ups, boss fights, loot.
5. No cheating talk. The anti-cheat rules are in the app under How scoring works.
6. No medical advice. Talk to a professional about injuries.
7. Keep it safe for work.
```

The relaunch welcome text lives in the script (`WELCOME`), so there is one copy.

## Roles

The eight rank titles from the app, plus two:

| Role | Color |
|------|-------|
| Recruit | #94A3B8 |
| Warrior | #10B981 |
| Gladiator | #06B6D4 |
| Knight | #A78BFA |
| Champion | #F59E0B |
| Warlord | #EF4444 |
| Conqueror | #F97316 |
| Legend | #FFD700 |
| Developer | #7C3AED (shown apart) |
| Beta Tester | #22D3EE |

Roles are given by hand for now. No third party bot (MEE6, Carl-bot) is set up.

## Server settings

- Verification level Low (verified email), set by the script
- System channel #introductions, set by the script
- Icon: `public/icon-circle.png` from the live site, set by the script when the server has none
- Community features: turn on at 50 members (unlocks discovery)
