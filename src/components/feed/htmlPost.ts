// Wraps a user's HTML-post body in a minimal document with the app's base
// styling, so HTML posts render coherently (and identically in the composer
// preview and the feed card). Always shown inside a sandboxed iframe with NO
// same-origin access, so the markup/scripts can't touch the user's account.
export function htmlPostDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0}
    body{font-family:Tahoma,"Segoe UI",system-ui,sans-serif;color:#1b2733;padding:10px;line-height:1.55;word-break:break-word;-webkit-font-smoothing:antialiased}
    img,iframe,video,canvas,svg{max-width:100%}
    a{color:#0a55cf}
    blockquote{border-left:3px solid #cdd6e0;margin:0 0 8px;padding-left:12px;color:#51606e}
    h1,h2,h3{line-height:1.2;margin:.4em 0}
    p{margin:.5em 0}
  </style></head><body>${html}</body></html>`;
}
