# Discord Server Setup — Departure: Fitness Quest

## Channel Structure

Create these categories and channels in order:

### Category: WELCOME
- `#rules` — Server rules (post once, lock channel)
- `#introductions` — "Post your rank + team name"

### Category: GENERAL
- `#chat` — Main discussion
- `#feedback-and-bugs` — Bug reports and app feedback
- `#feature-requests` — Vote on what to build next

### Category: THE JOURNEY
- `#monster-kills` — Share battle screenshots
- `#pr-celebrations` — Share your personal records
- `#team-recruitment` — Find teammates
- `#loot-drops` — Show off rare equipment drops

### Category: DEV LOG
- `#changelog` — App updates (only you can post)
- `#roadmap` — What's planned
- `#polls` — Community votes

---

## Rules (paste into #rules)

```
Welcome to the Departure: Fitness Quest community!

1. Be respectful. We're all here to get stronger.
2. No spam or self-promotion.
3. Keep feedback constructive — bugs go in #feedback-and-bugs.
4. Share your wins! PRs, rank-ups, battle results — we want to see them.
5. No cheating discussion. The anti-cheat exists for a reason.
6. Have fun. Train hard. Kill monsters.
```

---

## Bot Setup (MEE6 — free tier)

1. Go to mee6.xyz → Add to your server
2. Enable:
   - **Welcome messages**: "Welcome to Departure, {user}! Drop your rank and team name in #introductions."
   - **Auto-role**: Give new members a "Recruit" role automatically
3. Create a **scheduled message** (MEE6 premium, or use Carl-bot free):
   - Every Friday at 12 PM EST in #chat: "What was your biggest lift this week? Drop it below."

---

## Roles (color-coded by rank)

| Role | Color | Assign when |
|------|-------|-------------|
| Recruit | #94A3B8 (gray) | Default for new members |
| Warrior | #10B981 (green) | Self-assign or verified |
| Gladiator | #06B6D4 (cyan) | Self-assign or verified |
| Knight | #A78BFA (purple) | Self-assign or verified |
| Champion | #F59E0B (gold) | Self-assign or verified |
| Warlord | #EF4444 (red) | Self-assign or verified |
| Conqueror | #F97316 (orange) | Self-assign or verified |
| Legend | #FFD700 (gold) | Self-assign or verified |
| Developer | #7C3AED (purple) | You only |
| Beta Tester | #06B6D4 (cyan) | Early testers |

---

## Server Settings

- **Server icon**: Use the app icon (icon-circle.png)
- **Server banner**: Use one of the journey background images
- **Default channel**: #chat
- **Verification level**: Low (must have verified email)
- **Community features**: Enable if you hit 50 members (unlocks discovery)
