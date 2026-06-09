# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-06-09

### Added
- AI usage admin API, configurable per-user limits, free-first models
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- add 30s timeout to Gemini API calls
- skip text-only models when request has images
- remove dummy_key fallback that masked missing GEMINI_API_KEY
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- root Firebase config to deploy Firestore indexes
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-09

### Added
- AI usage admin API, configurable per-user limits, free-first models
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- skip text-only models when request has images
- remove dummy_key fallback that masked missing GEMINI_API_KEY
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- root Firebase config to deploy Firestore indexes
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-09

### Added
- AI usage admin API, configurable per-user limits, free-first models
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- remove dummy_key fallback that masked missing GEMINI_API_KEY
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- root Firebase config to deploy Firestore indexes
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- AI usage admin API, configurable per-user limits, free-first models
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- root Firebase config to deploy Firestore indexes
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- root Firebase config to deploy Firestore indexes
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- collectionGroup queries, batched writes, scrape rate-limiting
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- mutex lock, graceful skip of deleted/changed ads, env fail-fast
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- security: HTTPS guard for worker, repost audit trail, skip expired users
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- config constants, AdData type, structured log context
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- confirm session expiry before halting a user's whole repost batch
- retry scrape-views with exponential backoff before falling back

### Changed
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Fixed
- retry scrape-views with exponential backoff before falling back

### Changed
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- Vinted dual-template, language selector, feedback button + production-readiness fixes
- redesign extension popup with quick-action buttons

### Changed
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- redesign extension popup with quick-action buttons

### Changed
- commit in-progress changes to auth, extension, and ads actions

## [1.0.0] - 2026-06-08

### Added
- redesign extension popup with quick-action buttons

## [1.0.0] - 2026-06-08

### Added
- add Reply Templates feature with AI generation
- disable Vinted integration for MVP — replace with coming-soon state
- extract real username/email from cookies instead of mock
- implement extension token sync, manual copy template, navbar real username display, and upgrade AI models
- vinted and ebay connection UX enhancements with inline modal and popup
- AI optimization actions, photo-to-prefill page, Vinted/eBay cross-post stubs, and Gemini response parser fixes

### Fixed
- show email from JWT, hide name span when no user, remove garbage kb_username
- pass structured HttpException through analyzePhotos catch block and discriminate 429 error types in UI
- extract username from URL-encoded 'up' cookie for navbar display
- profile icon dropdown and complete logout flow
- switch to gemini-2.0-flash (1500 RPD free), healthCheck no-op, extractQuotaError with retry wait time
- fix truncated JSON — lower maxOutputTokens to 400, tighten prompt limits, add isJsonComplete() guard
- 30s timeout, [KI-Opt] logging, error panel with retry, Gemini health dot, GET /ai/health
- visible login 404 - fail fast on worker unavailable, sanitize errors, add callAutomationWorkerFast
- handshake TTL 120s, distinct error codes, German error card, retry postMessage bridge

### Changed
- add CHANGELOG.md and automated changelog generation workflow
- remove unused AiAssistant component
- Implement backend architecture (Auth, Ads, AI, Scheduler) and native Login UI
- UI refinements and rebranding to KleinanzeigenBoost
- Add dashboard UI, ads UI, and layout with mock data
- Initial scaffold

## [1.0.0] - 2026-06-08

### Added
- disable Vinted integration for MVP — replace with coming-soon state
- extract real username/email from cookies instead of mock
- implement extension token sync, manual copy template, navbar real username display, and upgrade AI models
- vinted and ebay connection UX enhancements with inline modal and popup
- AI optimization actions, photo-to-prefill page, Vinted/eBay cross-post stubs, and Gemini response parser fixes

### Fixed
- pass structured HttpException through analyzePhotos catch block and discriminate 429 error types in UI
- extract username from URL-encoded 'up' cookie for navbar display
- profile icon dropdown and complete logout flow
- switch to gemini-2.0-flash (1500 RPD free), healthCheck no-op, extractQuotaError with retry wait time
- fix truncated JSON — lower maxOutputTokens to 400, tighten prompt limits, add isJsonComplete() guard
- 30s timeout, [KI-Opt] logging, error panel with retry, Gemini health dot, GET /ai/health
- visible login 404 - fail fast on worker unavailable, sanitize errors, add callAutomationWorkerFast
- handshake TTL 120s, distinct error codes, German error card, retry postMessage bridge

### Changed
- remove unused AiAssistant component
- Implement backend architecture (Auth, Ads, AI, Scheduler) and native Login UI
- UI refinements and rebranding to KleinanzeigenBoost
- Add dashboard UI, ads UI, and layout with mock data
- Initial scaffold
