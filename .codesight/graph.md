# Dependency Graph

## Most Imported Files (change these carefully)

- `src\services\storage.ts` — imported by **19** files
- `server\src\config.js` — imported by **10** files
- `src\services\identityService.ts` — imported by **10** files
- `src\services\feedService.ts` — imported by **6** files
- `src\services\nostrService.ts` — imported by **5** files
- `server\src\store\index.js` — imported by **4** files
- `src\services\trustService.ts` — imported by **4** files
- `server\src\gun\relay.js` — imported by **3** files
- `server\src\identity.js` — imported by **3** files
- `src\services\profileService.ts` — imported by **3** files
- `src\services\presenceService.ts` — imported by **3** files
- `server\src\contrib\points.js` — imported by **2** files
- `server\src\lib\crypto.js` — imported by **2** files
- `server\src\rss\aggregator.js` — imported by **2** files
- `server\src\node\contributor.js` — imported by **2** files
- `server\src\publisher.js` — imported by **2** files
- `server\src\rss\feeds.js` — imported by **2** files
- `server\src\lib\http.js` — imported by **2** files
- `server\src\lib\hash.js` — imported by **2** files
- `src\components\feed\PostCard.tsx` — imported by **2** files

## Import Map (who imports what)

- `src\services\storage.ts` ← `src\services\alertsService.ts`, `src\services\changelogService.ts`, `src\services\chatroomService.ts`, `src\services\communityService.ts`, `src\services\companionService.ts` +14 more
- `server\src\config.js` ← `server\src\contrib\points.js`, `server\src\gun\relay.js`, `server\src\identity.js`, `server\src\index.js`, `server\src\node\contributor.js` +5 more
- `src\services\identityService.ts` ← `src\services\communityService.ts`, `src\services\deviceTransferService.ts`, `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts` +5 more
- `src\services\feedService.ts` ← `src\services\changelogService.ts`, `src\services\gunService.ts`, `src\services\index.ts`, `src\services\nostrService.ts`, `src\services\peerService.ts` +1 more
- `src\services\nostrService.ts` ← `src\services\feedService.ts`, `src\services\feedService.ts`, `src\services\globalChatService.ts`, `src\services\index.ts`, `src\services\index.ts`
- `server\src\store\index.js` ← `server\src\gun\relay.js`, `server\src\publisher.js`, `server\src\routes.js`, `server\src\rss\aggregator.js`
- `src\services\trustService.ts` ← `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts`, `src\services\moderationService.ts`
- `server\src\gun\relay.js` ← `server\src\contrib\points.js`, `server\src\index.js`, `server\src\publisher.js`
- `server\src\identity.js` ← `server\src\index.js`, `server\src\node\contributor.js`, `server\src\routes.js`
- `src\services\profileService.ts` ← `src\services\feedService.ts`, `src\services\gunService.ts`, `src\services\index.ts`
