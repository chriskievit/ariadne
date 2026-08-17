## [1.0.8](https://github.com/chriskievit/ariadne/compare/v1.0.7...v1.0.8) (2026-08-17)


### Bug Fixes

* **ci:** use an admin PAT for semantic-release's push to main ([#56](https://github.com/chriskievit/ariadne/issues/56)) ([e67fe6c](https://github.com/chriskievit/ariadne/commit/e67fe6c2a504ae342fe977a102ab48a5a40c6adc))
* **timer:** enforce a single running timer across all start paths ([#54](https://github.com/chriskievit/ariadne/issues/54)) ([fa860c1](https://github.com/chriskievit/ariadne/commit/fa860c1a0351d09e3deb085afa1402792ce9be05))

## [1.0.7](https://github.com/chriskievit/ariadne/compare/v1.0.6...v1.0.7) (2026-08-15)


### Bug Fixes

* close security gaps from the issue [#34](https://github.com/chriskievit/ariadne/issues/34) review (secrets exposure, TOML injection, unauthenticated LAN access) ([c967257](https://github.com/chriskievit/ariadne/commit/c967257b69113a08484e49b6a581c1e9dc65d225))
* gate CI on a production dependency audit and upgrade Next.js to close known CVEs ([46974d3](https://github.com/chriskievit/ariadne/commit/46974d3f35b29f28f9233cea4e41ae4628598437))

## [1.0.6](https://github.com/chriskievit/ariadne/compare/v1.0.5...v1.0.6) (2026-08-15)


### Bug Fixes

* stop header Pause button from being masked by a cached timer status ([0b45c0e](https://github.com/chriskievit/ariadne/commit/0b45c0ef89fc00b2e87b7815823a7ae218d1b597))

## [1.0.5](https://github.com/chriskievit/ariadne/compare/v1.0.4...v1.0.5) (2026-08-15)


### Bug Fixes

* add active-filter pills and a persistent clear button to the filter bar ([51945c0](https://github.com/chriskievit/ariadne/commit/51945c0e7b67f5c78c642de87eaea8b5a713aa2c))

## [1.0.4](https://github.com/chriskievit/ariadne/compare/v1.0.3...v1.0.4) (2026-08-15)


### Bug Fixes

* give snoozed items their own visible sub-list ([7503895](https://github.com/chriskievit/ariadne/commit/75038954b6d1a1121c4f2a35b3ba71bae0bbbd28))

## [1.0.3](https://github.com/chriskievit/ariadne/compare/v1.0.2...v1.0.3) (2026-08-15)


### Bug Fixes

* start both linked items when a timer is already running ([91c9325](https://github.com/chriskievit/ariadne/commit/91c9325e26d857e34454b1a5ab22560b2656c945))

## [1.0.2](https://github.com/chriskievit/ariadne/compare/v1.0.1...v1.0.2) (2026-08-15)


### Bug Fixes

* stop header timer chip immediately when timer stops elsewhere ([44d4d9a](https://github.com/chriskievit/ariadne/commit/44d4d9ad485a1280ae31490d6c30f7266eff9363))

## [1.0.1](https://github.com/chriskievit/ariadne/compare/v1.0.0...v1.0.1) (2026-08-15)


### Bug Fixes

* grant issues/pull-requests write for semantic-release's comment step ([7d9026b](https://github.com/chriskievit/ariadne/commit/7d9026b7440aa3a826e55d99e92c079391d49031))

# 1.0.0 (2026-08-15)


### Bug Fixes

* always surface inbox ad-hoc items in Needs Attention ([0844568](https://github.com/chriskievit/ariadne/commit/08445688e7dd835fbd7afe3bb513635cd7d1cd70))
* bump Node to 22 for semantic-release engine requirement ([2d795e6](https://github.com/chriskievit/ariadne/commit/2d795e6fc9722f0fcd4d747c4ebf0a4b8957c366))
* distinguish scope errors from rate limits in sync failures ([#38](https://github.com/chriskievit/ariadne/issues/38)) ([54bbbf9](https://github.com/chriskievit/ariadne/commit/54bbbf964ed7b86a5b3f814c8123bb9cebc3459f))
* format last-synced time in minutes/hours/days instead of raw minutes ([7a52736](https://github.com/chriskievit/ariadne/commit/7a52736cee7c33a913eed3f3208d97af93aa7592))
* give Needs attention cards room for readable titles ([c4a2ebd](https://github.com/chriskievit/ariadne/commit/c4a2ebd0c9eaf83c859af8ac677b3be5d9f19ca5))
* guard auto-sync reschedule against post-unmount timer leak ([fb23a2e](https://github.com/chriskievit/ariadne/commit/fb23a2e0a6ff4f248d10f6c6d883d53c53978b52))
* guard ReportDashboard against invalid date ranges and fetch failures ([dab58b1](https://github.com/chriskievit/ariadne/commit/dab58b1257521e3bafe6dac36b1c1d5f023fbeb9))
* make column migrations tolerate a lost concurrent-migration race ([69b5dda](https://github.com/chriskievit/ariadne/commit/69b5dda18d8f454e7fa79ce689462499eb02e368))
* move priority indicator to a dot and fix last-item border ([f69f367](https://github.com/chriskievit/ariadne/commit/f69f367aca4c814c6d9ffb0adea201b47670a9c2))
* park stops the running timer instead of leaving it open ([7acaf4a](https://github.com/chriskievit/ariadne/commit/7acaf4a863645aff3b28207fcebdc989d46806c9))
* prevent GitHub sync failure from a single unstatusable PR item ([9f3223d](https://github.com/chriskievit/ariadne/commit/9f3223d16eb51fef69786f9186ba4bad98ad9d72))
* prioritize assigned over mentioned reason for ADO items ([a830562](https://github.com/chriskievit/ariadne/commit/a830562ce25408d079c0664396ff2abf280ca2ee))
* require explicit hours on completion, fix report day bucketing ([62970ef](https://github.com/chriskievit/ariadne/commit/62970efbd65e32e6f64b7b04e49213508ed548bc))
* satisfy Item.adoStatus type in rowToItem ([818d87b](https://github.com/chriskievit/ariadne/commit/818d87b4656ddabcaac34f5c6854d24a6c61d557))
* search modal shows real matches and stops leaving items stuck faded ([#37](https://github.com/chriskievit/ariadne/issues/37)) ([043ff4a](https://github.com/chriskievit/ariadne/commit/043ff4ab5099a24df723c360bf71a7166a95b9b5))
* show both Assigned and Mentioned pills instead of collapsing precedence ([29eac9a](https://github.com/chriskievit/ariadne/commit/29eac9ace70c5fb44ce1b162956928ed4546a572))
* sprint counter names its denominator ([ba2bd72](https://github.com/chriskievit/ariadne/commit/ba2bd7201959b177b4de2c4aedf6ade6328110a7))
* stop unmounting Complete cascade dialog before use, thread ScoredItem type, exclude done items from Start cascade ([ce261a6](https://github.com/chriskievit/ariadne/commit/ce261a66f822552513206b8fa5469d5f71014da9))
* surface sync failures instead of swallowing them silently ([0aca52c](https://github.com/chriskievit/ariadne/commit/0aca52c343fd5c49684bae91dbe410ebb0564caa))
* surface write failures and repo-fetch failures as toasts in Open in Claude flow ([b13242b](https://github.com/chriskievit/ariadne/commit/b13242b831daac09a5580886ccb5fc778284f653))
* switch from Legacy Launch Configurations to Tab Configs ([43bf1c7](https://github.com/chriskievit/ariadne/commit/43bf1c7807b0f52b14f803384d088489715e1b1a))
* truncate long status/reason pills instead of wrapping to their own row ([8ee43ae](https://github.com/chriskievit/ariadne/commit/8ee43aeb25cce9a27620f8d499cd3258aeee7342))


### Features

* 44px touch targets for primary actions, the overflow menu, and filter chips ([0a45b8d](https://github.com/chriskievit/ariadne/commit/0a45b8d19c64767eced99491e04a704b6474e094))
* add /api/saved-views route and client wrappers ([e36993c](https://github.com/chriskievit/ariadne/commit/e36993c044f0ee8c2080d735b8bc0c5ea36454a6))
* add /report page and dashboard/settings navigation links ([a4fe246](https://github.com/chriskievit/ariadne/commit/a4fe246c2a2f2c88c705aa42410c4c80636b9a12))
* add a Parked section for in-progress items you can set aside ([38ba487](https://github.com/chriskievit/ariadne/commit/38ba4874d7ea7fd7cb575ed1c509ac57b9a594da))
* add a pin/unpin today toggle to ItemRow ([fe55b1d](https://github.com/chriskievit/ariadne/commit/fe55b1d368cf690ee26652b63f78c9705a7041d3))
* add a today bucket to getGroupedItems, exclusive of the score buckets ([acafebf](https://github.com/chriskievit/ariadne/commit/acafebf748d791a25d6d1395ee61f8d830985189))
* add ado_status column with migration for pre-existing databases ([5810231](https://github.com/chriskievit/ariadne/commit/5810231472507e8e23d510a3057102d17a3a218c))
* add Ariadne-branded top bar with global search, nav, and theme toggle ([325a470](https://github.com/chriskievit/ariadne/commit/325a470a39acf2f920ed3153ba9952f558b4607a))
* add back-to-queue button for in-progress items ([089e4f7](https://github.com/chriskievit/ariadne/commit/089e4f7249fd1cb58e693a303f092e64bfa0c48d))
* add delete button for ad-hoc items ([3e3fdde](https://github.com/chriskievit/ariadne/commit/3e3fddecd3e7d476c981881292debcd54b8e6154))
* add dependency-free local-date helpers for Today ([8de6243](https://github.com/chriskievit/ariadne/commit/8de6243bc4860fffa9af7ae6701214d053ee8b39))
* add Docker packaging and self-host setup docs ([#30](https://github.com/chriskievit/ariadne/issues/30)) ([43865ef](https://github.com/chriskievit/ariadne/commit/43865ef68694eb2b43cbdc9ed27b5a5a01bf05a5))
* add dropdown-menu UI wrapper for the row overflow menu ([c68d92c](https://github.com/chriskievit/ariadne/commit/c68d92c7008e0efb75c0d519a5225c46aac1b787))
* add fetchLocalRepos and openInClaude API client functions ([9b369aa](https://github.com/chriskievit/ariadne/commit/9b369aaa786d0f8842ebdd2cb24b94e95f27ae86))
* add GET /api/local-repos endpoint ([f2eb964](https://github.com/chriskievit/ariadne/commit/f2eb9643466c28ee88c4da097a529f96bf77aec7))
* add GET /api/report endpoint ([09f2341](https://github.com/chriskievit/ariadne/commit/09f2341c4bce97f85fe8f244b1f529ac39ee97e1))
* add getLinksForItems read helper resolving ADO/GitHub item links ([7db3d9f](https://github.com/chriskievit/ariadne/commit/7db3d9f79b23c643edd664b8971a9764fccf64a2))
* add getTodaySummary and per-item hours-logged-today ([3a68590](https://github.com/chriskievit/ariadne/commit/3a68590d1b591ad589fea1f7c149bf1ea5b2d764))
* add global keymap (⌘K, ⌘Z, /, ?, g d, g s, R, W) and the help sheet ([bb71c43](https://github.com/chriskievit/ariadne/commit/bb71c43bda841a5cbf0b2f7f02b500ca9ab6b0b7))
* add item_links table for ADO work item / GitHub PR correlation ([08256c5](https://github.com/chriskievit/ariadne/commit/08256c52a4651b6ffdaefe6820ad424a312a9bc4))
* add lib/calibration.ts, estimate-vs-actual by work type ([dd6992e](https://github.com/chriskievit/ariadne/commit/dd6992e9904c41b1eb8fefc1af5b171adf46ada4))
* add lib/grouping.ts, obligation buckets for the Signals list ([75b542c](https://github.com/chriskievit/ariadne/commit/75b542c4373cee1aedd1ba470964da3e4c8e7706))
* add lib/keymap.ts, the single source of declared key bindings ([e746c18](https://github.com/chriskievit/ariadne/commit/e746c188c8dda5a30a7250105e4a1b47537dfb17))
* add lib/plans-repo.ts, plan and plan-item CRUD with reordering ([ec263c0](https://github.com/chriskievit/ariadne/commit/ec263c0c2366b94061efa190fbbe95c224b52623))
* add lib/query.ts, the nine-prefix query grammar ([60e4b72](https://github.com/chriskievit/ariadne/commit/60e4b72929f2f53e930278e09d92b09f4ecac160))
* add lib/saved-views.ts, persisted through the settings table ([19e7b9c](https://github.com/chriskievit/ariadne/commit/19e7b9c24e7d013b1217fca890b08030aa2a05ea))
* add lib/snooze.ts, snooze-until computation ([c31ebf4](https://github.com/chriskievit/ariadne/commit/c31ebf48870127d13e6df6c9443878edd98a1f99))
* add lib/sync-status.ts, per-source freshness and error classification ([ab49660](https://github.com/chriskievit/ariadne/commit/ab49660cf64eaa99503b32f8f03208cdb7e3d2b7))
* add local repo path resolution for Warp launch ([46b623d](https://github.com/chriskievit/ariadne/commit/46b623db07edfcd644721d4fdba03e1a3c6420a3))
* add Open in Claude button and folder picker to ItemRow ([6888167](https://github.com/chriskievit/ariadne/commit/68881674053dac42dd72ecf3381a92c9a7af0185))
* add plan and timer API routes, wire plan_items into the today route ([4dbd2fb](https://github.com/chriskievit/ariadne/commit/4dbd2fb8819a12f86993b0968f4b26cec2410611))
* add PlanDayDialog, the four-step plan-the-day ritual ([7d8c9ed](https://github.com/chriskievit/ariadne/commit/7d8c9ed95a2b328f11b4dd494a0a44bdadd57667))
* add plans and plan_items tables, capacity and nudge settings ([ed9ec9a](https://github.com/chriskievit/ariadne/commit/ed9ec9ad019d821700ebeaa7634ebcb2e44bce58))
* add POST /api/items/[id]/open-claude endpoint ([0ac5d39](https://github.com/chriskievit/ariadne/commit/0ac5d394c86e5fed4e37aaac0d08b968b6f04383))
* add pr_status column and PrStatus type ([57fcabf](https://github.com/chriskievit/ariadne/commit/57fcabf630076c38a2ecd70c7f5e6651b9d493ca))
* add QueryBar, query text and filter chips as one state ([e0f0f1e](https://github.com/chriskievit/ariadne/commit/e0f0f1e521e74a08288bb65a123c6ba818eaa1f5))
* add ReportDashboard UI with donut and stacked-bar charts ([8996b08](https://github.com/chriskievit/ariadne/commit/8996b08859ade9c4a2848f9a9394c797462bd5ae))
* add requeue API route ([f797841](https://github.com/chriskievit/ariadne/commit/f7978417e0d8ce75832851ba66523a104ede2712))
* add ScoreChip, a real button replacing the priority dot ([d52e733](https://github.com/chriskievit/ariadne/commit/d52e733001083e9ec79143cf88c80d1cd87dff49))
* add search filtering to dashboard ([8c2741d](https://github.com/chriskievit/ariadne/commit/8c2741dc1b37c96b2e4414b31f101e1bc741a6ae))
* add semantic-release config for automated versioning and changelog ([2e15990](https://github.com/chriskievit/ariadne/commit/2e15990814a20f922204ad67d9199aaa1097df0a))
* add setTodayDate and clear today_date when an item starts ([2aaf636](https://github.com/chriskievit/ariadne/commit/2aaf636bb5805a889b37cd949cf063e3f6d9e3e6))
* add SignalsBoard, replacing the source-column layout ([e9b334d](https://github.com/chriskievit/ariadne/commit/e9b334d4880104c970a30093df9e3a2057054268))
* add star/snooze/done API routes and client wrappers ([170e8c4](https://github.com/chriskievit/ariadne/commit/170e8c4fccc75949bcb1ed71d0f2eabe5b5dc653))
* add starred, snoozed_until, triage_state, woke_early columns ([43f6520](https://github.com/chriskievit/ariadne/commit/43f6520bace6ba7e3e9d270282cd66c83819423c))
* add status pill label/color mapping ([3ce313d](https://github.com/chriskievit/ariadne/commit/3ce313d21585a974d93bdec9293d6c6322b1a72d))
* add success badge variant and design tokens ([5782139](https://github.com/chriskievit/ariadne/commit/5782139e9829ab9baa573532f99805e2325b6313))
* add the ⌘K command palette, replacing the header search input ([04cfbbb](https://github.com/chriskievit/ariadne/commit/04cfbbbd642bcc28154351f5eeefe5ac12918a07))
* add the first-run no-tokens-yet empty state ([e7d627e](https://github.com/chriskievit/ariadne/commit/e7d627e7a9acf776c71d70d844235d915d15ff84))
* add the P (plan the day) global keybinding ([08e6fc1](https://github.com/chriskievit/ariadne/commit/08e6fc18c1a84f45cb71cea0081e01fbddc91f0f))
* add the running-timer header chip, switch-timer dialog, and long-run nudge ([8365538](https://github.com/chriskievit/ariadne/commit/83655386bc09d42391779137b02e9f3ceb284cfa))
* add the scoring reference dialog ([67c335d](https://github.com/chriskievit/ariadne/commit/67c335dff2e22e3a34d82f6430912976803d8e14))
* add time report aggregation (lib/report.ts) ([5232a13](https://github.com/chriskievit/ariadne/commit/5232a131a8e94ce51cc5ad18b3d0412ecd3841e0))
* add today pin/unpin and today-summary API routes ([f6c85c1](https://github.com/chriskievit/ariadne/commit/f6c85c16732984a2961e49708c6df2e56e9b6146))
* add today_date column for the Today bucket ([649c9eb](https://github.com/chriskievit/ariadne/commit/649c9ebd1dd91bd028458af60633d0974a2af4fd))
* add todayDate to the Item type ([f2e977e](https://github.com/chriskievit/ariadne/commit/f2e977ed90a715677edc440b98e01041cf9a82f0))
* add TodaySection and the Review my day shutdown dialog ([cfab6b3](https://github.com/chriskievit/ariadne/commit/cfab6b31d743d3af1f6f24b667ebf19fc637a96e))
* add Warp local repo settings to the settings form ([7f41a33](https://github.com/chriskievit/ariadne/commit/7f41a33f59617b7f865a1daa32ad68dba2eccb2d))
* attach linked items to each item in getGroupedItems ([af66343](https://github.com/chriskievit/ariadne/commit/af66343895212cb07c24b13b2ce7c3afd43434ee))
* auto-sync every 5 minutes ([cb1aa9d](https://github.com/chriskievit/ariadne/commit/cb1aa9d997366ad12d78369f7e1a04b909815c17))
* base sprint completion on synced ADO story status ([557288f](https://github.com/chriskievit/ariadne/commit/557288f184e79a369331e1ec73314168843250e9))
* build and push versioned Docker image to GHCR on release ([b2c4018](https://github.com/chriskievit/ariadne/commit/b2c4018ba92622ab0965571115cedbc8c2c51ebc))
* cascade Start/Complete to linked items via confirm dialogs ([902dd88](https://github.com/chriskievit/ariadne/commit/902dd88146037825270184c87603740ab75c6edf))
* collapse ItemRow to one primary action, overflow menu, and one inline badge ([c10d281](https://github.com/chriskievit/ariadne/commit/c10d281ad20c0e3a0cb73445cac43d6274a6a5f7))
* derive PR status from draft/review state during GitHub sync ([be43a9e](https://github.com/chriskievit/ariadne/commit/be43a9eb0124753dd0f13180fb3c12f69280ab95))
* detect unresolved GitHub PR review conversations ([a82c21d](https://github.com/chriskievit/ariadne/commit/a82c21dbbe15d42bf04e62ca3d1e324eb80e9bc8))
* drop Complete to outline emphasis, match its toast to its name, disclose the token trust model ([2c57b02](https://github.com/chriskievit/ariadne/commit/2c57b02196699ea059f8c68545b7e50ff2ec321b))
* explain unfired scoring rules and break ties by oldest activity ([8067a5f](https://github.com/chriskievit/ariadne/commit/8067a5f7d0696304b7a4373e9af1ea4d99562f9a))
* extend ShutdownDialog into Wrap up the day with plan comparison and a note ([b41bebf](https://github.com/chriskievit/ariadne/commit/b41bebf5c20f976e8f47836496347d68d63418f8))
* extract AB# work item references from synced PR text ([24a193c](https://github.com/chriskievit/ariadne/commit/24a193c745a68762f78f7350b38172af40934942))
* fetch System.State from Azure DevOps as adoStatus ([28a02b9](https://github.com/chriskievit/ariadne/commit/28a02b946157e12082c8927274dd30fc118db342))
* fold Parked into In Progress as a dimmed sub-list, close Everything Else by default ([ced21ee](https://github.com/chriskievit/ariadne/commit/ced21eed4273be8a5402b76218ef84789e7fcc5f))
* generate a user-facing scoring reference from lib/scoring.ts's own tables ([b8abf36](https://github.com/chriskievit/ariadne/commit/b8abf36744ecc5bb82cfb6c32688b9786e5a8302))
* give Blocked its own filled badge variant, decoupled from warning ([b19895b](https://github.com/chriskievit/ariadne/commit/b19895be2952b638ebcc69223272c6e6c66bd5a0))
* honour prefers-reduced-motion globally ([c643bd1](https://github.com/chriskievit/ariadne/commit/c643bd1e49724996b4a66cbf772aa92db23e4b64))
* ItemRow wraps rather than sheds content below 640px ([f1e6c97](https://github.com/chriskievit/ariadne/commit/f1e6c973ed6dc542a8ed84dd589d5b4f0295496d))
* make the Paused sub-list a real disclosure with aria-expanded ([18e0503](https://github.com/chriskievit/ariadne/commit/18e0503713c9318456a18e0f8a95cba91ba95b03))
* mark rows from a failing source as stale, with their own read age ([eabccc4](https://github.com/chriskievit/ariadne/commit/eabccc4f9d63c0fce84444c712accf11e38b1082))
* merge needsAttention and everythingElse into one signals list ([db72601](https://github.com/chriskievit/ariadne/commit/db726012d12ab9156f7f391f0464fe2507430937))
* migrate time_logs from duration_minutes to duration_hours ([0ce82f2](https://github.com/chriskievit/ariadne/commit/0ce82f29c59be24f524d356d4697c1298b4ecf58))
* move In progress above Needs Attention, collapsed by default ([82d921d](https://github.com/chriskievit/ariadne/commit/82d921d86686dee021f4dd33c76ec079a77c11a9))
* one design token system for status, urgency, and density (P0) ([36fc804](https://github.com/chriskievit/ariadne/commit/36fc804752d932df0d04987f87522d5355b23754))
* order Today by plan_items.sort_order, carry estimate/logged onto ScoredItem ([3e03f0f](https://github.com/chriskievit/ariadne/commit/3e03f0f361facbe341acc3019c0acb4068a5772f))
* per-source sync status, sprint elapsed marker, ghost refresh ([b2c036b](https://github.com/chriskievit/ariadne/commit/b2c036bc1c668cda5a88880feeff0075840f534d))
* persist ado_status through upsertSyncedItem ([2fb1167](https://github.com/chriskievit/ariadne/commit/2fb1167393d568eb1c4bb8c448d1a0e2b0d6b8bb))
* persist item_links rows when syncing a PR's linked work item ids ([b0dd774](https://github.com/chriskievit/ariadne/commit/b0dd7746794bf3c9d4b8d83c1a2d86e9aa3da28b))
* persist pr_status in items-repo ([5474a6f](https://github.com/chriskievit/ariadne/commit/5474a6fd372f87eb34cbfe5467a7545e265b9286))
* query-matched-nothing offers a one-click narrowing fix ([d1396bc](https://github.com/chriskievit/ariadne/commit/d1396bc2bd8e54462710252821a37ff5b1da93b4))
* reach the scoring reference from every breakdown popover, plus keyboard shortcuts and scoring reference in ⌘K and Settings ([597984f](https://github.com/chriskievit/ariadne/commit/597984ff34138bb68ca09f8ad3f5957a9ba2e820))
* relocate ad-hoc add trigger into the ambient sprint header ([1c1d544](https://github.com/chriskievit/ariadne/commit/1c1d54434d4d38da68c9fac15b2f8ba041419a7c))
* rename durationMinutes to durationHours in complete API ([d95721b](https://github.com/chriskievit/ariadne/commit/d95721be7a99f038b6c5c2d4d3b86d0467bab6be))
* rename TimeLog.durationMinutes to durationHours ([47505af](https://github.com/chriskievit/ariadne/commit/47505af0469ad07530e0ced3f74d350c94af1ddd))
* render status pill on item rows ([18fa2be](https://github.com/chriskievit/ariadne/commit/18fa2be3e42f769b14d0cbda522f605abc64b68d))
* replace the priority dot with ScoreChip, fold pin into overflow menu ([9c95d0e](https://github.com/chriskievit/ariadne/commit/9c95d0ec2aa5d840e958e294162b4e1bdbe15d14))
* row-level keyboard nav, focus ring, and star/snooze/done actions ([171abf5](https://github.com/chriskievit/ariadne/commit/171abf54529846d9c3b41c1723ba729c6d498055))
* say nothing-waiting-on-you plainly instead of a zero count ([3b799dd](https://github.com/chriskievit/ariadne/commit/3b799ddebed37c101dfb9e4978d31111497a9967))
* set page title to "Work overview" and add favicon ([f898b60](https://github.com/chriskievit/ariadne/commit/f898b60388e05e2bccb54080603b06dca8ed4828))
* show linked ADO work item / GitHub PR badges on item rows ([4ce4e24](https://github.com/chriskievit/ariadne/commit/4ce4e24276bf50cf18325cda266130e237b632e8))
* show repo name as subtitle on GitHub item cards ([97004ea](https://github.com/chriskievit/ariadne/commit/97004ea1c50cb41b19a33dfb5f6f3d807a3593bd))
* show score breakdown popover on priority pill ([e8d5a59](https://github.com/chriskievit/ariadne/commit/e8d5a59fdcfd7f450dc778d0aa3f0ba8ff8981dc))
* show the day's estimate in the complete dialog when one exists ([e86a79b](https://github.com/chriskievit/ariadne/commit/e86a79b8335e9b4c665c2d2ab255d685409d6e6a))
* shrink SprintProgressHeader to a single ambient row ([b39db14](https://github.com/chriskievit/ariadne/commit/b39db1430b11d12b8068257f23d2c9629a328550))
* switch time-spent input from minutes to hours ([09809f9](https://github.com/chriskievit/ariadne/commit/09809f9454edff01d8498040df8dbf5787c33cd0))
* Today gets a real Plan-the-day CTA, hand ordering, and a capacity line ([e261b44](https://github.com/chriskievit/ariadne/commit/e261b4414a08248a4b74a3c0d4579021138b1dbb))
* track merged GitHub PR status and exclude merged PRs from candidates ([27ef764](https://github.com/chriskievit/ariadne/commit/27ef7642f1b2e1a7ef7889b58eb338867660cfd2))
* wake a snoozed item early when upstream activity changes it ([3076409](https://github.com/chriskievit/ariadne/commit/3076409717e1f9f312eb2e0b1ab8afaded4307c4))
* wire j/k navigation, starred-first sort, and triage handlers into Dashboard ([738f10e](https://github.com/chriskievit/ariadne/commit/738f10e7bb234649dc232761d4bf79bad94f262f))
* wire Open in Claude button up through Dashboard ([debba4e](https://github.com/chriskievit/ariadne/commit/debba4e29df02c71e3c4fe2387304de82aa148cc))
* wire SignalsBoard into Dashboard, remove the Everything else card ([1d6dd49](https://github.com/chriskievit/ariadne/commit/1d6dd496507a82879d03a0ac3970517ec12bbe54))
* wire the plan ritual, wrap-up extensions, and timer switching into Dashboard ([4d93b18](https://github.com/chriskievit/ariadne/commit/4d93b189755afa3657686d967ac3b757afe96708))
* wire the query grammar and saved views into SignalsBoard ([925fc5a](https://github.com/chriskievit/ariadne/commit/925fc5a7c25bd0be3da33a84e1cfddd116de2592))
* wire the Today section and shutdown dialog into the dashboard ([521d0ce](https://github.com/chriskievit/ariadne/commit/521d0ceb24a992db0c70ed692048807b9f3541c1))
* wire up client API calls for pinning and reviewing today ([f1337be](https://github.com/chriskievit/ariadne/commit/f1337bed3ada11ffe5768a9b57d742376bfe92a9))
* write a reusable Warp Launch Configuration for claude sessions ([7d9a220](https://github.com/chriskievit/ariadne/commit/7d9a2204b584a6170808c5d947b811f5b0d17bc4))
