# Ledger — Decentralized Moderation Architecture

> Moderation here is **not** ban/delete by a platform. Content can exist on the
> network; **every user and community decides what they see**. The system is a
> *trust + filtering* layer, local-first, explainable, and auditable. The AI is a
> **council member that advises**, never an unquestionable authority.

## Principles
1. **No global truth.** The network never decides what is universally acceptable.
2. **Communities define standards.** Each community carries its own values.
3. **Users decide what they trust.** A personal layer always overrides.
4. **AI assists, humans decide.** The agent produces *suggestions* with reasons.
5. **Transparent & auditable.** Every reduction/flag shows why, by whom, with what signals.
6. **Contextual trust.** No single universal score — trust is per-community and per-viewer.
7. **Local-first.** No central moderation DB; data lives with users, syncs P2P (Gun).

## The pipeline — layered, not a single LLM verdict

`moderationService.evaluate(content, ctx) → Verdict`

Signals considered (each contributes a weighted, labeled factor):

| Layer | Signal | Source |
|---|---|---|
| Content | spam/scam/nsfw/toxic lexicons, link-spam, ALL-CAPS, repetition | local heuristics (swappable for an on-device classifier) |
| Similarity | cosine vs. locally-remembered "known-bad" vectors | `embeddings` |
| Reputation | author's reputation **in this context** (community + global) | `reputationService` / `profileService` |
| History | account age, prior verdicts on this author | identity `createdAt`, local verdict log |
| Web of trust | "do people *I* trust vouch for / block this author?" | `trustService` (1-hop) |
| Community rules | which categories matter + strictness | `CommunityValues` |
| User layer | the viewer's own moderation profile + mutes | settings, `trustService` |

These compose into a **Verdict**:

```
{ action: "allow" | "warn" | "reduce" | "review" | "flag" | "hide",
  confidence: 0..1,
  reasoning: string,          // human-readable, e.g. "New account + 3 links + not vouched by anyone you trust"
  signals: { label, weight, detail }[] }
```

- **Obvious** cases (scam phrasing + new account + zero trust) resolve **automatically** (flag/hide).
- **Nuanced** cases (mixed signals) → `review` (surface to community) or `warn`, never silently deleted.
- **Trusted** authors (vouched by your web of trust) get the benefit of the doubt (`allow`).

The action is **advice**: the UI reduces/expands accordingly, and the user can always **"show anyway."** Nothing is deleted from the network.

## Reputation & trust (contextual, not one number)
- Reputation (helpful/expertise/participation/trust) is earned, shown per person.
- **Web of trust** (`trustService`): directed edges — `vouch`, `block`, `report`, `mute` — optionally **scoped to a community**. Trust answers *"is this person trusted by the people/communities I trust?"* via direct + 1-hop endorsements, not a global score. The same person can be trusted in `#guns` and unknown in `#faith`.
- Negative signals (reports, blocks, repeated violations) lower contextual trust; positive ones (vouches, good history) raise it.
- Edges sync over Gun so trust spreads through relationships, with **no central authority**.

## Community-defined moderation
Each community has `CommunityValues`: a **philosophy preset** (professional / casual / faith / open / custom) that sets *which* categories matter, profanity tolerance, focus (e.g. harassment), and strictness. The agent **adapts to the community's rules** instead of enforcing one worldview — the *same* post can be `allow` in a gaming room and `reduce` in a professional one.

## Transparency & audit
Every non-allow verdict is **inspectable in place**: the post shows a banner with the action, confidence, reasoning, the signals that contributed, and whether AI assisted. Moderation actions are recorded locally (an audit log) — no mysterious moderation.

## The AI as council member
The local agent reasons over *all* the signals above (not just "is this bad?"), and can escalate to the on-device LLM for genuinely nuanced calls — producing `review` with an explanation rather than a unilateral delete. It can be overruled by the community and by you.

## Implementation status (this repo)
Implemented: `trustService` (vouch/block/mute/report, contextual + 1-hop scoring, Gun-synced); a layered, explainable `moderationService.evaluate`; per-community values; feed visibility driven by verdicts with an in-place "why / show anyway" expander; post-author trust actions; a transparency view of signals. The LLM-escalation path and richer audit history are scoped as next steps.
