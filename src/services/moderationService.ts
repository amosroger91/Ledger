// ============================================================
//  moderationService — a layered, explainable moderation *advisor*
//  (not a platform delete switch). The actual scoring lives in the
//  dependency-free lib/moderationCore (shared with the feed worker so
//  the feed and composer never disagree); this thin wrapper just
//  gathers the viewer's web-of-trust values for the author and hands
//  them in. The action is advice the UI applies (reduce / review /
//  flag…); the user can always override. See MODERATION.md.
// ============================================================
import type { ModerationProfile, ModerationVerdict } from "@/types";
import { trustService } from "./trustService";
import { evaluateModeration, type EvalContext } from "@/lib/moderationCore";

export type { EvalContext } from "@/lib/moderationCore";

class ModerationService {
  /** The layered evaluation. Returns a graded, explainable verdict. */
  evaluate(text: string, ctx: EvalContext): ModerationVerdict {
    const pk = ctx.authorPk;
    const tw = pk
      ? { blocked: trustService.isBlocked(pk), muted: trustService.isMuted(pk), score: trustService.score(pk, ctx.community), vouchCount: trustService.vouchCount(pk) }
      : { blocked: false, muted: false, score: 0, vouchCount: 0 };
    return evaluateModeration(text, ctx, tw);
  }

  /** Content-only check for your own composer (no author/trust layers). */
  classify(text: string, profile: ModerationProfile): ModerationVerdict {
    return this.evaluate(text, { profile });
  }
}

export const moderationService = new ModerationService();
