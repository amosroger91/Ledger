// ============================================================
//  ledger-core — the hot-path numeric core for the Ledger feed,
//  compiled to WASM. This is a 1:1 port of src/lib/embeddings.ts:
//  same EMBED_DIM, same FNV-1a bucketing, same tokenizer + stopword
//  list, all math in f64 — so outputs are bit-identical to the TS
//  reference and previously-stored embeddings stay compatible. The
//  TS module keeps the original implementation as a runtime fallback.
//
//  Why WASM: embed() runs per-post on every create / RSS item /
//  Nostr event (hundreds per refresh) and cosine() runs per-post
//  inside the feed ranker. Tight float loops are exactly what WASM
//  speeds up, and the JS<->WASM boundary stays cheap because we pass
//  plain strings in and typed arrays out (with embed_many batching a
//  whole refresh into a single crossing).
// ============================================================
use wasm_bindgen::prelude::*;

pub const EMBED_DIM: usize = 256;

const STOP: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "at", "by", "is",
    "are", "was", "be", "it", "this", "that", "you", "i", "we", "they", "he", "she",
];

fn is_stop(t: &str) -> bool {
    STOP.contains(&t)
}

/// Mirror of the TS tokenizer:
///   lowercase -> strip http(s) URLs -> replace any char not [a-z0-9#@\s]
///   with a space -> split on whitespace -> keep tokens len>1 that aren't stopwords.
/// After the strip pass every surviving token is pure ASCII, so byte == char
/// indexing holds for the trigram + hash steps below.
fn tokens(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let no_urls = strip_urls(&lower);
    let cleaned: String = no_urls
        .chars()
        .map(|c| {
            if c.is_ascii_whitespace() {
                ' '
            } else if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '#' || c == '@' {
                c
            } else {
                ' '
            }
        })
        .collect();
    cleaned
        .split_whitespace()
        .filter(|t| t.len() > 1 && !is_stop(t))
        .map(|t| t.to_string())
        .collect()
}

/// Remove `https?://` followed by non-whitespace, matching JS /https?:\/\/\S+/g.
fn strip_urls(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let rest = &s[i..];
        if rest.starts_with("http://") || rest.starts_with("https://") {
            // skip the scheme + everything up to the next ASCII whitespace
            let mut j = i;
            while j < bytes.len() && !bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            out.push(' ');
            i = j;
        } else {
            // advance one char (handle multibyte safely)
            let ch = rest.chars().next().unwrap();
            out.push(ch);
            i += ch.len_utf8();
        }
    }
    out
}

/// FNV-1a over ASCII bytes, then bucket into EMBED_DIM. Matches the TS
/// `Math.imul`-based hash exactly via u32 wrapping arithmetic.
fn hash(s: &str) -> usize {
    let mut h: u32 = 0x811c_9dc5;
    for &b in s.as_bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    (h as usize) % EMBED_DIM
}

fn embed_into(text: &str, v: &mut [f64]) {
    debug_assert_eq!(v.len(), EMBED_DIM);
    for x in v.iter_mut() {
        *x = 0.0;
    }
    for tok in tokens(text) {
        v[hash(&tok)] += 1.0; // word feature
        let b = tok.as_bytes();
        if b.len() >= 3 {
            for i in 0..b.len() - 2 {
                // tok is ASCII here, so byte slicing == JS slice(i, i+3)
                let tri = &tok[i..i + 3];
                v[hash(tri)] += 0.5; // char tri-gram feature
            }
        }
    }
    // L2 normalize (norm || 1, matching the TS guard)
    let mut norm = 0.0;
    for &x in v.iter() {
        norm += x * x;
    }
    norm = norm.sqrt();
    if norm == 0.0 {
        norm = 1.0;
    }
    for x in v.iter_mut() {
        *x /= norm;
    }
}

/// Embed one string into a normalized EMBED_DIM vector (Float64Array).
#[wasm_bindgen]
pub fn embed(text: &str) -> Vec<f64> {
    let mut v = vec![0.0f64; EMBED_DIM];
    embed_into(text, &mut v);
    v
}

/// Batch-embed `texts` (NUL-separated) into a single flat Float64Array of
/// length texts.len() * EMBED_DIM. One JS<->WASM crossing for a whole RSS /
/// Nostr refresh instead of one per item. NUL never appears in feed text.
#[wasm_bindgen]
pub fn embed_many(joined: &str) -> Vec<f64> {
    if joined.is_empty() {
        return Vec::new();
    }
    let parts: Vec<&str> = joined.split('\u{0}').collect();
    let mut out = vec![0.0f64; parts.len() * EMBED_DIM];
    for (i, t) in parts.iter().enumerate() {
        let start = i * EMBED_DIM;
        embed_into(t, &mut out[start..start + EMBED_DIM]);
    }
    out
}

/// Cosine similarity of two already-L2-normalized vectors (== dot product).
/// Returns 0 on length mismatch, matching the TS guard.
#[wasm_bindgen]
pub fn cosine(a: &[f64], b: &[f64]) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
    }
    dot
}

/// Top `n` keywords driving a vector, for "why recommended" explanations.
/// Ties resolve by first-occurrence order, matching JS Map iteration + the
/// stable Array.sort the TS uses.
#[wasm_bindgen]
pub fn top_terms(text: &str, n: usize) -> Vec<String> {
    let mut order: Vec<String> = Vec::new();
    let mut counts: std::collections::HashMap<String, (u32, usize)> =
        std::collections::HashMap::new();
    for t in tokens(text) {
        let next_idx = order.len();
        let e = counts.entry(t.clone()).or_insert_with(|| {
            order.push(t.clone());
            (0, next_idx)
        });
        e.0 += 1;
    }
    let mut entries: Vec<(&String, u32, usize)> =
        counts.iter().map(|(k, v)| (k, v.0, v.1)).collect();
    // count desc, then first-occurrence asc (stable tiebreak)
    entries.sort_by(|a, b| b.1.cmp(&a.1).then(a.2.cmp(&b.2)));
    entries.into_iter().take(n).map(|e| e.0.clone()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embed_is_normalized() {
        let v = embed("hello world rust wasm");
        let norm: f64 = v.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((norm - 1.0).abs() < 1e-9);
        assert_eq!(v.len(), EMBED_DIM);
    }

    #[test]
    fn empty_embed_is_zero_not_nan() {
        let v = embed("");
        assert!(v.iter().all(|x| *x == 0.0));
    }

    #[test]
    fn cosine_self_is_one() {
        let v = embed("the quick brown fox jumps");
        assert!((cosine(&v, &v) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn top_terms_orders_by_count() {
        let t = top_terms("apple apple banana cherry banana apple", 2);
        assert_eq!(t, vec!["apple".to_string(), "banana".to_string()]);
    }
}
