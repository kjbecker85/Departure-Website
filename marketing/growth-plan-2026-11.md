# Growth Plan, November 2026: Departure: Fitness Quest (iOS)

Draft for review. App Store ID 6761634387, bundle com.qualia.fitness.

## The short version

- Today: 50 accounts in total, 1 new account and 2 active accounts in the last 30 days. Android is in closed beta only.
- The app has almost no traffic. Fix the store listing first, because every other channel sends people to it.
- Spend the $200 a month on Apple Ads Advanced, search results only, exact match keywords. Expect about 40 to 65 installs a month from it. That is a small number, but it is 40 to 65 times the current rate.
- The cheapest installs come from people Kyle already knows and from teams. A team needs friends, so every new user should be asked to bring one.
- Inside the app, the biggest risks are a 27 screen onboarding before the first workout and no product analytics to see where people drop off.

What was checked: the marketing drafts in this folder, the website pages in `src/pages/`, `constants/iapProducts.ts` and parts of the app code (onboarding, rating prompt, reminders, battle cooldown). Apple Ads facts come from web searches on 2026-11-21. Apple's own help pages and the benchmark sites could not be opened directly from this session, so the figures below come from search result summaries. Check them in the Apple Ads dashboard before spending.

What was not checked: App Store Connect numbers (impressions, page views, conversion), the live listing as it stands today, keyword search volumes, and the live rules of each subreddit.

---

## 1. App Store listing fixes

| Field | Proposal | Length | Why |
|---|---|---|---|
| Title | `Departure: Workout Tracker RPG` | 30 / 30 | "workout tracker" is the main search people type; the brand stays first. |
| Subtitle | `Gym Log, Ranks & Boss Fights` | 28 / 30 | Adds "gym" and "log" for search and says what makes the app different. |
| Keywords | `fitness,game,weightlifting,exercise,strength,gamified,level,habit,raid,team,monster,1rm,quest,xp` | 96 / 100 | No word from the title or subtitle is repeated, since Apple already indexes those. |

Notes on the keyword field:

- "fitness" and "quest" moved out of the title, so they belong here now.
- Remove "dark souls" from the current draft. It is another company's trademark. Apple's review guideline 2.3.7 forbids trademarked terms and other apps' names in metadata, and it can get the update rejected.
- Apple combines words across title, subtitle and keywords. "workout" plus "game" covers "workout game"; "gym" plus "tracker" covers "gym tracker".
- After 4 weeks of Apple Ads data, swap the two weakest keywords for search terms that brought installs.

First three lines of the description (the part shown before "more"):

```
Log real sets, reps and weight. Every set earns XP.
Rank up through 24 tiers and fight 24 bosses with your team.
Free. No ads. No subscription.
```

- Line 1 tells a tracker searcher that this is a real tracker. Most people searching "workout tracker" want that first.
- Line 2 gives the game in numbers, which are easy to believe.
- Line 3 answers the price question before it is asked.

Screenshot order (the first three appear in search results):

1. **Workout log with XP earned.** Caption: "Log real lifts. Earn XP." It proves the tracker for the people who searched for one.
2. **Team boss battle result.** Caption: "Your team's workouts fight the boss." This is the part no other tracker has.
3. **AI future self.** Caption: "See where your training takes you." It is the strongest emotional hook.
4. **Rank up screen.** Caption: "24 ranks, Recruit to Legend." It shows long term progress.
5. **Equipment drop.** Caption: "Loot from every win." It shows rewards.
6. **Personal records (trophy case).** Caption: "Records found for you." It is useful to serious lifters.
7. **Pricing card.** Caption: "Free. No ads. No subscription." It removes the last doubt.

Other listing fixes found in the files:

- Promotional text: drop "Dark Souls inspired" for the same trademark reason. Suggested: "Your lifts earn XP. Your team fights bosses. A real workout tracker with RPG ranks. Free, no ads."
- `constants/iapProducts.ts` describes the Cooldown Skip as "from 4hr to 2hr". `lib/battle.ts` uses a 24 hour cooldown. Fix the product description in App Store Connect so buyers get what they read.
- The pricing page (`src/pages/pricing.astro`) has a "Get Notified" button on the free plan. The app is live, so link it to the App Store page instead. Only `index.astro` links to the store today.
- The Reddit and Product Hunt drafts say "Free on iOS and Android". Android is in closed beta. Say "Free on iOS" until it is public.
- The r/gamification draft says the daily cap is 500 XP. The app's rule is 300 XP. Fix it before posting.

---

## 2. Apple Ads with $200 a month

### Facts that shape the plan

- **There is no minimum spend.** Apple's Search Ads page says so ([Apple Ads Advanced](https://searchads.apple.com/advanced)).
- **Basic** charges per install, up to a cost you choose, with a monthly budget of up to $10,000 per app. You get no keyword control and one placement ([Apple: compare solutions](https://ads.apple.com/app-store/help/apple-ads-basic/0001-compare-apple-ads-solutions), [Adapty 2026 guide](https://adapty.io/blog/apple-search-ads/)).
- **Advanced** charges per tap, up to a maximum bid you set per keyword, with a daily budget and no budget maximum. It gives keyword bidding and all four placements ([Apple: how pricing works](https://searchads.apple.com/help/advanced/0003-how-pricing-works)).
- **Placements**: search results, Search tab, Today tab and product pages ("You Might Also Like") ([Apple: ad placement options](https://ads.apple.com/app-store/help/ad-placements/0081-ad-placement-options)). Search tab ads use cost per tap ([Apple Ads news](https://ads.apple.com/news)). Third party guides describe Today tab ads as priced per thousand impressions, which means paying for views whether or not anyone taps ([Adapty](https://adapty.io/blog/apple-search-ads/)). That last point is not confirmed on Apple's pages.
- **Cost per tap** for US Health & Fitness search results:
  - AppTweak's 2025 benchmark gives $1.59, against a $1.91 median across all US categories ([AppTweak benchmarks](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)).
  - RocketShip HQ gives a $1.88 median for 2026, with $0.92 at the 25th percentile and $3.14 at the 75th ([RocketShip HQ](https://www.rocketshiphq.com/?p=5321)).
  - Plan on about $1.60 to $1.90 per tap.
- **Cost per install**:
  - Adapty puts the overall US figure at $2.51 for all categories ([Adapty 2026 benchmarks](https://adapty.io/blog/apple-ads-benchmarks-2026/)).
  - AppTweak tables show Health & Fitness at $3.77 and $1.68. Their labels are unclear, so neither is treated as solid here.
  - SplitMetrics' category figures are behind a form ([SplitMetrics 2026 report](https://splitmetrics.com/apple-ads-search-results-benchmarks-2026/)).

### Choice: Advanced, search results only

- Choose Advanced. It shows which search terms bring installs, and that data feeds the keyword field in section 1. Basic hides it.
- Turn off the Search tab, Today tab and product page placements. They reach people who were not searching for a workout app, and $200 is too small to test them.
- Fallback: if nobody can spend 15 minutes a week on the account, use Basic with a $3.50 maximum cost per install and a $200 monthly budget.

### Realistic results

- $200 a month is about $6.50 a day.
- At $1.60 to $1.90 per tap, that buys about 105 to 125 taps a month.
- A new app with few ratings converts taps to installs worse than average. Assume 40 to 55 percent.
- **Expect about 40 to 65 installs a month**, at a cost per install of about $3 to $5.
- Brand keyword installs would partly have come anyway, so the true gain is a little lower.
- Not every install becomes an account that logs a workout. Judge the ads by **cost per account that logs a first workout**, not by installs alone.
- Start the ads only after the new listing is live. Paying for taps on a weak page wastes the budget.

### Campaign structure

One campaign per group, so each has its own daily cap. US only, iPhone, all ages 18+.

| Campaign | Match type | Daily cap | Purpose |
|---|---|---|---|
| Brand | Exact | $0.75 | Keep the top spot when someone searches the name. |
| Category | Exact | $3.25 | Main source of new users. |
| Competitor | Exact | $1.50 | Reach users of other trackers and habit games. |
| Discovery | Broad match plus Search Match | $1.00 | Find new search terms. Add every exact keyword above as a negative here. |
| **Total** | | **$6.50** | About $198 in a 30 day month. |

### Starting keywords (exact match)

| # | Campaign | Keyword | Max cost per tap |
|---|---|---|---|
| 1 | Brand | departure fitness quest | $0.75 |
| 2 | Brand | departure fitness | $0.75 |
| 3 | Brand | departure app | $0.60 |
| 4 | Category | workout tracker | $2.00 |
| 5 | Category | gym tracker | $1.80 |
| 6 | Category | workout log | $1.80 |
| 7 | Category | gym workout log | $1.60 |
| 8 | Category | weightlifting tracker | $1.60 |
| 9 | Category | lifting tracker | $1.60 |
| 10 | Category | fitness game | $1.50 |
| 11 | Category | workout game | $1.40 |
| 12 | Category | gym game | $1.20 |
| 13 | Category | fitness rpg | $1.20 |
| 14 | Category | gamified fitness | $1.20 |
| 15 | Category | rpg workout | $1.00 |
| 16 | Competitor | hevy | $1.50 |
| 17 | Competitor | strong workout tracker | $1.50 |
| 18 | Competitor | fitbod | $1.80 |
| 19 | Competitor | jefit | $1.20 |
| 20 | Competitor | habitica | $0.80 |
| 21 | Discovery | (Search Match on, broad: "workout tracker", "fitness game") | $1.00 |

The bids sit at or a little above the category median on high intent terms and below it on game terms, which should be cheaper and less contested. These are starting points, not benchmarks for each keyword.

### The two week rule, for each keyword

Target: cost per install of $4 or less.

1. **Fewer than 50 impressions:** the bid is too low to show. Raise it 20 percent once, never above $2.50. If it is still under 50 after one more week, pause it.
2. **15 or more taps and no install:** pause it. The searchers wanted something else.
3. **3 or more installs at a cost per install above $6:** cut the bid 25 percent. If it is still above $6 two weeks later, pause it.
4. **Cost per install under $3.50 and impression share under 50 percent:** raise the bid 15 to 20 percent. Pay for it with money freed from paused keywords. Keep the daily total at $6.50.
5. **Discovery:** a search term with 2 or more installs becomes an exact keyword in Category and a negative keyword in Discovery.
6. **Never raise a bid** on a keyword with fewer than 3 installs, except under rule 1.

---

## 3. Free channels, ranked by expected installs per hour

These rates are estimates for an app at this stage, not measured figures. Measure them in the first month by giving each channel its own link (App Store campaign links, `pt` and `ct` parameters, show up in App Store Connect).

| Rank | Channel | Rough installs per hour | First concrete action |
|---|---|---|---|
| 1 | Warm network and team invites | 2 to 4 | Message 20 people who lift with the App Store link and a team invite code. Ask each to bring one friend to the team. |
| 2 | Reddit, subreddits that allow developer posts | 1 to 3, very uneven | Post the r/SideProject builder story on a Tuesday morning US time, with the App Store link where the rules allow it. |
| 3 | Reddit, fitness subreddits' own threads | 0.5 to 2 | Post a short note in r/Fitness's Self Promotion Saturday thread and its monthly Apps, Gadgets and Gear thread. |
| 4 | TikTok and Instagram Reels | 0.5 to 5, grows with volume | Film three 15 second screen recordings: the AI future self reveal, a bench press session killing a goblin, and a legendary drop. Post one a day for three weeks. |
| 5 | Product Hunt | 0.5 to 2, one day spike | Wait until the listing has 10 or more ratings. Then update the draft and launch on a Tuesday. |
| 6 | Discord server | close to 0 for new installs | Wait. Build it from the existing draft once there are 25 weekly active users. Until then, use the team chat inside the app. |

Subreddit rules to respect (from mirrors of each subreddit's wiki, so check the live sidebar before posting):

- **r/Fitness** forbids self promotion. Posting your own content without talking to the moderators first can bring a permanent ban. Ads are allowed only in Self Promotion Saturday. A monthly thread covers apps and gear ([r/Fitness rules mirror](https://cal1.lr.ggtyler.dev/r/Fitness/wiki/rules/rule2), [r/Fitness wiki mirror](https://reddit.rtrace.io/r/Fitness/wiki/intro)).
- **r/fitness30plus** allows no direct self promotion. Hidden self promotion usually ends in a permanent ban ([mirror](https://r.datuan.dev/r/fitness30plus/wiki/rules)).
- **r/xxfitness** limits self promotion to a thread every two weeks ([mirror](https://lr.sudovanilla.org/r/xxfitness/comments/1frpacj/biweekly_self_promotion_thread_sell_yourself_and)).
- **r/bodyweightfitness** has its own rules page. Read it before using the bodyweight draft ([mirror](https://lr.vern.cc/r/bodyweightfitness/wiki/rules)).
- **r/weightroom, r/GYM, r/gainit, r/loseit**: rules were not found. Message the moderators before posting.
- Developer friendly: r/SideProject, r/IndieGaming, r/iOSapps and r/gamification are where the drafts fit best. Post there first.

Changes to the existing Reddit drafts:

- Where links are allowed, use the link. "DM me for the link" loses most readers.
- The plan to open with r/Fitness, r/GYM and r/weightroom carries the highest ban risk. Move them last, and use only their official threads.

---

## 4. In app fixes for retention and revenue

| # | Fix | What the code shows | Effort |
|---|---|---|---|
| 1 | **Add product analytics** (PostHog or Firebase, events for each onboarding step, first workout, team join, purchase) | Only Sentry is installed. Today there is no way to see where new users drop off. | Small |
| 2 | **Shorten onboarding** to reach a first logged workout in about 2 minutes. Ask for body stats, sleep, nutrition and the photo after the first workout. | `app/(onboarding)/_layout.tsx` lists 27 screens between welcome and complete, before any workout. | Medium |
| 3 | **Fix the rating prompt guard** and add a first personal record trigger. | `lib/ratingPrompt.ts` says "never prompt before the 3rd app open", but `mayPrompt` does not count app opens. The current triggers (first rank up, battle win, streak milestone) are good moments. With so few ratings, each new one helps the store page convert. | Small |
| 4 | **Personal referral reward**: a link that gives both people coins and one AI image credit after the friend logs a first workout. | Team invite codes exist (`app/team/join.tsx`), but there is no reward for bringing a friend. | Medium |
| 5 | **Starter Pack offer right after the first workout**, shown once, at $4.99. | The Starter Pack exists (`bundle_starter_v2`). The moment after a first win is when a first purchase is most likely. | Small |
| 6 | **Optional subscription**, for example a "Departure Pass" at $4.99 a month or $29.99 a year: monthly AI image credits, a weekly cooldown skip and a monthly banner. Keep every one time purchase. | Every product is one time today. AI images cost money for each generation, so recurring revenue matches a recurring cost. The website and listing promise "No subscriptions". Kyle should decide this before any copy changes. | Medium |
| 7 | **Win back email** to the 48 accounts that have not been active in 30 days, with what changed and a free cooldown skip. | The accounts are in Supabase. | Small |
| 8 | **Lapsed user push** on day 3 and day 7 without a workout ("Your team needs you for the Goblin Shaman"). | Daily reminders are scheduled at 8 AM by default from the home screen (`app/(tabs)/index.tsx`). There is no message tied to a missed week or to the team. | Small to medium |
| 9 | **A solo path for users without a team**, for example a weekly solo boss. | Battles are team battles. A new user with no friends in the app has no boss to fight. Not tested in the app, check it. | Large |

Order: 1, 3 and 7 this week. 2 and 5 next. 4 and 8 within the month. Decide on 6 before the 90 day review.

---

## 5. Weekly numbers and targets

Pull these every Monday. Count workouts only with `is_certified = true`, because uncertified rows are planned workouts and inflate the counts.

| Number | Source | Today | 30 day target | 90 day target |
|---|---|---|---|---|
| Product page views | App Store Connect | not checked | baseline set | double the baseline |
| Page view to install rate | App Store Connect | not checked | baseline set | baseline plus 25 percent |
| Installs, by source (ads, Reddit, social, other) | App Store Connect, campaign links | not checked | 20 a week | 40 a week |
| New accounts | Supabase `profiles` | about 0.25 a week | 10 a week | 20 a week |
| Total accounts | Supabase | 50 | 90 | 250 |
| Onboarding completion | analytics (fix 1) | unknown | 60 percent | 70 percent |
| First workout within 24 hours of sign up | Supabase `workouts` | unknown | 40 percent | 50 percent |
| Week 1 retention (a workout in days 2 to 7) | Supabase | unknown | 20 percent | 25 percent |
| Weekly active users (1 or more workouts that week) | Supabase | about 1 | 10 | 35 |
| Users in a team with 2 or more members | Supabase `team_members` | not checked | 10 | 40 |
| Ratings, count and average | App Store Connect | not checked | 10, 4.5 or higher | 30, 4.5 or higher |
| Paying users, total | RevenueCat | not checked | 3 | 12 |
| Revenue per month | RevenueCat | not checked | $30 | $150 |
| Apple Ads cost per install | Apple Ads | none yet | $4 or less | $3.50 or less |
| Apple Ads cost per account with a first workout | Apple Ads and Supabase | none yet | $8 or less | $6 or less |

How to read them:

- If installs rise but first workouts do not, the problem is onboarding, not marketing. Do fix 2 before spending more.
- If page views rise but installs do not, the listing is the problem. Test a new first screenshot.
- At 90 days, if weekly active users are above 35 and week 1 retention is above 25 percent, raise the Apple Ads budget. If not, keep it at $200 and work on the app.

---

## Sources

- [Apple Ads Advanced: no minimum spend](https://searchads.apple.com/advanced)
- [Apple: compare Apple Ads solutions (Basic and Advanced)](https://ads.apple.com/app-store/help/apple-ads-basic/0001-compare-apple-ads-solutions)
- [Apple: how pricing works (Advanced)](https://searchads.apple.com/help/advanced/0003-how-pricing-works)
- [Apple: ad placement options](https://ads.apple.com/app-store/help/ad-placements/0081-ad-placement-options)
- [Apple Ads news: Search tab cost per tap](https://ads.apple.com/news)
- [Adapty: Apple Search Ads in 2026, cost, placements and bidding](https://adapty.io/blog/apple-search-ads/)
- [Adapty: Apple Ads benchmarks 2026](https://adapty.io/blog/apple-ads-benchmarks-2026/)
- [AppTweak: Apple Ads benchmarks by category](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [RocketShip HQ: Health & Fitness cost per tap 2026](https://www.rocketshiphq.com/?p=5321)
- [SplitMetrics: Apple Ads search results benchmarks 2026](https://splitmetrics.com/apple-ads-search-results-benchmarks-2026/)
- Subreddit rule mirrors are linked in section 3.
