function buildUI(kbUrl) {
  const kbDisplay = kbUrl ? kbUrl.replace(/^https?:\/\//, '') : '';
  const kbLink = kbUrl
    ? '<a href="' + kbUrl + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-hover);text-decoration:none">' + kbDisplay + '</a>'
    : '';
  const kbNote = kbUrl
    ? 'Content is sourced from <strong>' + kbLink + '</strong> — curated snapshots captured at multiple points over the past several months.'
    : 'Content comes from curated snapshots captured at multiple points over the past several months.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Knowledge Query</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2e3147;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    --text: #e2e4f0;
    --muted: #6b7280;
    --source-bg: #1e2235;
    --error: #ef4444;
    --success: #22c55e;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 16px 80px;
  }
  header { width: 100%; max-width: 720px; margin-bottom: 20px; }
  h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
  h1 span { color: var(--accent); }
  .subtitle { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }
  .info-card {
    width: 100%; max-width: 720px; margin-bottom: 24px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; font-size: 0.82rem; color: var(--muted); line-height: 1.6;
  }
  .info-card p + p { margin-top: 6px; }
  .info-card strong { color: var(--text); font-weight: 600; }
  form { width: 100%; max-width: 720px; display: flex; flex-direction: column; gap: 12px; }
  textarea {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    color: var(--text); font-size: 0.95rem; line-height: 1.5; padding: 14px 16px;
    resize: vertical; min-height: 80px; outline: none; transition: border-color 0.15s; width: 100%;
  }
  .samples { display: flex; flex-wrap: wrap; gap: 8px; margin-top: -4px; }
  .sample-btn {
    background: var(--source-bg); border: 1px solid var(--border); border-radius: 20px;
    color: var(--accent-hover); cursor: pointer; font-size: 0.75rem; padding: 4px 12px;
    transition: border-color 0.15s, background 0.15s; white-space: normal; text-align: left;
  }
  .sample-btn:hover { border-color: var(--accent); background: var(--surface); }
  textarea:focus { border-color: var(--accent); }
  textarea::placeholder { color: var(--muted); }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  button[type="submit"] {
    margin-left: auto; background: var(--accent); border: none; border-radius: 8px;
    color: #fff; cursor: pointer; font-size: 0.9rem; font-weight: 600; padding: 10px 24px;
    transition: background 0.15s, opacity 0.15s;
  }
  button[type="submit"]:hover { background: var(--accent-hover); }
  button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }
  #result { width: 100%; max-width: 720px; margin-top: 28px; display: none; flex-direction: column; gap: 16px; }
  .answer-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px 22px; line-height: 1.65; font-size: 0.95rem; white-space: pre-wrap;
  }
  .answer-card.uncertain { border-color: #d97706; }
  .answer-card.error { border-color: var(--error); color: var(--error); }
  .meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 0.78rem; color: var(--muted); }
  .badge { background: var(--source-bg); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; }
  .badge.warn { border-color: #d97706; color: #fbbf24; }
  .badge.ok { border-color: #166534; color: var(--success); }
  .sources-label { font-size: 0.8rem; color: var(--muted); font-weight: 600; line-height: 1.4; }
  .sources { display: flex; flex-wrap: wrap; gap: 8px; }
  .source-chip {
    background: var(--source-bg); border: 1px solid var(--border); border-radius: 6px;
    font-size: 0.75rem; padding: 4px 10px; word-break: break-all;
    color: var(--accent-hover); text-decoration: none; transition: border-color 0.1s;
  }
  .source-chip:hover { border-color: var(--accent); }
  .conflict-note {
    background: #1f1a0a; border: 1px solid #78350f; border-radius: 8px;
    color: #fcd34d; font-size: 0.82rem; padding: 10px 14px;
  }
  .spinner {
    width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  #wake-banner {
    width: 100%; max-width: 720px; display: none; align-items: center; gap: 10px;
    background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
    border-radius: 8px; color: #fbbf24; font-size: 0.82rem; padding: 10px 14px; margin-bottom: 16px;
  }
  #wake-banner.ready { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: var(--success); }
  #wake-banner svg { flex-shrink: 0; }
  .wake-spin { animation: spin 0.9s linear infinite; }
</style>
</head>
<body>
<header>
  <h1>Knowledge <span>Query</span></h1>
  <p class="subtitle">Natural language queries over curated content snapshots · powered by Claude Haiku</p>
</header>
<div class="info-card">
  <p>${kbNote} Answers are grounded strictly in those snapshots — if the answer isn't there, it returns <strong>"I don't know"</strong> rather than guess.</p>
  <p>Ask in plain English — no keywords needed. BM25 retrieval finds the most relevant excerpts and Claude synthesizes a direct answer with cited sources. A <strong>confidence badge</strong> flags weak evidence.</p>
</div>
<div id="wake-banner">
  <svg id="wake-icon" class="wake-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20"/>
  </svg>
  <span id="wake-text">Backend waking up from idle</span>
  <span id="wake-elapsed" style="font-family:monospace;opacity:0.7"></span>
</div>
<form id="form">
  <textarea id="question" placeholder="Ask a question about the knowledge base…" required></textarea>
  <div class="samples">
    <span style="font-size:0.75rem;color:var(--muted);align-self:center">Try a sample:</span>
    <button type="button" class="sample-btn">What are the mortgage rates right now?</button>
    <button type="button" class="sample-btn">What credit cards are offered and what are their APRs?</button>
    <button type="button" class="sample-btn">What free insurance benefit does the credit union provide to member-owners?</button>
  </div>
  <div class="row">
    <span style="font-size:0.75rem;color:var(--muted)">Press Enter or click Ask to submit</span>
    <button type="submit" id="submit-btn">Ask</button>
  </div>
</form>
<div id="result">
  <div id="answer-card" class="answer-card"></div>
  <div id="meta" class="meta"></div>
  <div id="conflict-note" class="conflict-note" style="display:none"></div>
  <div id="sources-wrap" style="display:none">
    <p class="sources-label">Sources</p>
    <div id="sources" class="sources"></div>
  </div>
</div>
<script>
const form = document.getElementById("form");
const questionEl = document.getElementById("question");
const submitBtn = document.getElementById("submit-btn");
const resultEl = document.getElementById("result");
const answerCard = document.getElementById("answer-card");
const metaEl = document.getElementById("meta");
const conflictEl = document.getElementById("conflict-note");
const sourcesWrap = document.getElementById("sources-wrap");
const sourcesEl = document.getElementById("sources");
const wakeBanner = document.getElementById("wake-banner");
const wakeText = document.getElementById("wake-text");
const wakeIcon = document.getElementById("wake-icon");
const wakeElapsed = document.getElementById("wake-elapsed");

let _backendReady = false;
const SLOW_MS = 250;

(function pollHealth() {
  const t0 = Date.now();
  let slowTimer = setTimeout(() => {
    wakeBanner.style.display = "flex";
    submitBtn.disabled = true;
    const tick = setInterval(() => {
      if (_backendReady) { clearInterval(tick); return; }
      wakeElapsed.textContent = ((Date.now() - t0) / 1000).toFixed(1) + "s";
    }, 200);
  }, SLOW_MS);

  function check() {
    fetch("/health").then(r => r.json()).then(d => {
      const ready = d.api && d.api.ready;
      if (ready) {
        clearTimeout(slowTimer);
        _backendReady = true;
        submitBtn.disabled = false;
        if (wakeBanner.style.display !== "none" && wakeBanner.style.display !== "") {
          wakeIcon.classList.remove("wake-spin");
          wakeIcon.innerHTML = '<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
          wakeText.textContent = "Backend ready";
          wakeElapsed.textContent = "";
          wakeBanner.classList.add("ready");
          setTimeout(() => { wakeBanner.style.display = "none"; wakeBanner.classList.remove("ready"); }, 1800);
        }
      } else {
        setTimeout(check, 2000);
      }
    }).catch(() => setTimeout(check, 3000));
  }
  check();
})();

document.querySelectorAll(".sample-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    questionEl.value = btn.textContent.trim();
    questionEl.focus();
  });
});

questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionEl.value.trim();
  if (!question) return;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';
  answerCard.className = "answer-card";
  answerCard.innerHTML = "";
  metaEl.innerHTML = "";
  conflictEl.style.display = "none";
  sourcesWrap.style.display = "none";
  sourcesEl.innerHTML = "";
  resultEl.style.display = "flex";
  try {
    const res = await fetch("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) {
      answerCard.className = "answer-card error";
      answerCard.textContent = data.detail || data.error || "Error from API";
    } else {
      answerCard.className = data.confident ? "answer-card" : "answer-card uncertain";
      answerCard.innerHTML = data.answer.replace(/https?:\\/\\/[^\\s<>"']+/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-hover);text-decoration:underline">' + u + '</a>');
      metaEl.innerHTML = '<span class="badge ' + (data.confident ? "ok" : "warn") + '">' + (data.confident ? "confident" : "uncertain") + '</span><span>' + data.latency_ms + ' ms</span>';
      if (data.conflict_note) { conflictEl.textContent = "⚠ " + data.conflict_note; conflictEl.style.display = "block"; }
      if (data.sources && data.sources.length) {
        const seen = new Set();
        data.sources.forEach(s => {
          if (seen.has(s.url)) return;
          seen.add(s.url);
          const a = document.createElement("a");
          a.className = "source-chip";
          a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = s.url.replace(/^https?:\\/\\//, "");
          sourcesEl.appendChild(a);
        });
        const label = sourcesWrap.querySelector(".sources-label");
        if (label) {
          label.innerHTML = data.confident
            ? "Sources"
            : "Sources <span style=\\"font-weight:400;color:var(--muted)\\">— raw BM25 chunks, low accuracy when uncertain</span>";
        }
        sourcesWrap.style.display = "block";
      }
    }
  } catch (err) {
    answerCard.className = "answer-card error";
    answerCard.textContent = "Network error: " + err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Ask";
  }
});
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(buildUI(env.KNOWLEDGE_BASE_URL || ""), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    if (url.pathname === "/query" && request.method === "POST") {
      const apiUrl = env.API_URL;
      if (!apiUrl) {
        return new Response(JSON.stringify({ detail: "API_URL not configured" }), {
          status: 503, headers: { "Content-Type": "application/json" },
        });
      }
      const body = await request.text();
      try {
        const upstream = await fetch(`${apiUrl}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await upstream.text();
        return new Response(data, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ detail: "Backend unreachable — still waking up, please retry" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    if (url.pathname === "/health") {
      const apiUrl = env.API_URL;
      if (!apiUrl) return new Response(JSON.stringify({ worker: "ok", api: "not configured" }), {
        headers: { "Content-Type": "application/json" },
      });
      try {
        const upstream = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await upstream.json();
        return new Response(JSON.stringify({ worker: "ok", api: data }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ worker: "ok", api: "unreachable" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
