# CyfyClaw

**AI Detection Engineering Platform for Enterprise SOCs.**

CyfyClaw helps SOC analysts and Detection Engineers optimize Datadog Security
Monitoring rules. Its single objective: **reduce false positives as much as
possible without reducing detection coverage.** It never recommends changes
merely to lower alert volume.

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · lucide-react · Framer Motion
- **Backend:** FastAPI · Pydantic v2 · httpx · Server-Sent Events streaming
- **Agents (dual, parallel):** two independent reviews per rule —
  **Chief Detection Engineer** (Kimi-K2.7-Code) and **Principal Security
  Reviewer** (DeepSeek-R1) — each via any OpenAI-compatible endpoint (default:
  Hugging Face Inference Providers router). Fully configurable — no model name
  is hardcoded, and more agents can be added by configuration.

---

## How it works

The backend sends your rule to the configured model with a system prompt that
drives a private, multi-stage detection-engineering review (intent → condition
review → realistic false positives → adversarial self-challenge → optimization →
final recommendation). DeepSeek-R1's chain-of-thought is stripped server-side, so
you only ever see the final answer, formatted in 12 fixed sections:

1. Executive Summary · 2. Rule Purpose · 3. Detection Logic Review ·
4. MITRE ATT&CK Mapping · 5. False Positive Analysis · 6. Fine-Tuning
Recommendations · 7. Production-Ready Tuned Rule · 8. Engineering Explanation ·
9. Operational Impact · 10. Risks and Trade-offs · 11. Confidence Level ·
12. Final Recommendation

> **Verify before deploying.** CyfyClaw is a decision-support tool. Every tuned
> rule should be reviewed by a human before it reaches production.

---

## Dual-agent architecture

Every submitted rule is analysed by **two independent agents running in
parallel** (`asyncio.gather` fan-out). Each agent receives only the shared
detection-engineering system prompt, its own persona, and your rule — **neither
agent ever sees the other's output**, so the two reviews are genuinely
independent.

| Agent | Role | Model | Emphasis |
| --- | --- | --- | --- |
| **Agent 1** | Chief Detection Engineer | `moonshotai/Kimi-K2.7-Code` | Understand intent, map MITRE ATT&CK/OCSF, produce a production-ready tuned rule, explain every change, give a confidence score. |
| **Agent 2** | Principal Security Reviewer | `deepseek-ai/DeepSeek-R1` | Independently challenge unsafe exclusions, preserve coverage, produce its own tuned rule + reasoning + confidence score. |

Both produce the same 12-section report (with a numeric `Confidence Score: NN/100`
in Section 11). The two reviews are shown **side by side, not merged** — you
compare them yourself.

**Streaming.** Rather than returning one blocking JSON blob, `/api/analyze`
streams **agent-tagged** Server-Sent Events so both panels fill in live:

```
data: {"type":"meta","agent":"kimi","content":"moonshotai/Kimi-K2.7-Code:novita"}
data: {"type":"meta","agent":"deepseek","content":"deepseek-ai/DeepSeek-R1:auto"}
data: {"type":"token","agent":"kimi","content":"## 1. Executive Summary…"}
data: {"type":"token","agent":"deepseek","content":"## 1. Executive Summary…"}
data: {"type":"done","agent":"kimi","content":""}
data: {"type":"done","agent":"deepseek","content":""}
data: {"type":"done","content":""}          ← overall completion
```

If one agent fails (bad model id, provider down), it emits a tagged `error`
event and the other agent still completes — failures are isolated per agent.

**Provider abstraction (extensible by config).** All streaming and reasoning
suppression lives in `BaseLLMProvider`; `KimiProvider` and `DeepSeekProvider`
are thin subclasses that only supply configuration. Adding a third agent is a
new small subclass plus env vars — no changes to orchestration, routes, or the
frontend contract.

---

## Repository layout

```
cyfyclaw/
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── api/             # routes: health, templates, analyze
│   │   ├── core/            # error handlers
│   │   ├── services/        # providers (Base/Kimi/DeepSeek), orchestrator,
│   │   │                    #   llm_client, prompts, seed library
│   │   ├── config.py        # env-driven settings (nothing hardcoded)
│   │   ├── schemas.py       # Pydantic request/response models
│   │   └── main.py          # app factory
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # Next.js app
│   ├── app/                 # layout, page, globals.css
│   ├── components/          # Sidebar, ChatWorkspace, PromptBox, Markdown, …
│   ├── lib/                 # api client, zustand store, types
│   ├── Dockerfile
│   └── package.json
├── nginx/cyfyclaw.conf      # reverse proxy + SSE config for Ubuntu VPS
├── scripts/                 # dev.sh, smoke_test.sh
├── docker-compose.yml
├── .env.example
├── LICENSE
└── README.md
```

---

## 1. Environment variables

Copy `.env.example` to `.env` and fill it in. **Secrets live only in the backend
environment and are never exposed to the browser.**

| Variable | Where | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | backend | Hugging Face token with **Inference Providers** scope. Shared by both agents. |
| `KIMI_MODEL` | backend | Agent 1 model id (Chief Detection Engineer). Default `moonshotai/Kimi-K2.7-Code:novita`. |
| `KIMI_BASE_URL` | backend | Agent 1 OpenAI-compatible base URL. Falls back to `LLM_BASE_URL`. |
| `DEEPSEEK_MODEL` | backend | Agent 2 model id (Principal Security Reviewer). Falls back to `HF_MODEL_ID`. |
| `DEEPSEEK_BASE_URL` | backend | Agent 2 base URL. Falls back to `LLM_BASE_URL`. |
| `KIMI_TEMPERATURE` / `DEEPSEEK_TEMPERATURE` | backend | Optional per-agent temperature (fall back to `LLM_TEMPERATURE`). |
| `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` / `LLM_TIMEOUT` | backend | Shared generation controls. `LLM_TIMEOUT_SECONDS` is also accepted. |
| `HF_MODEL_ID` / `LLM_BASE_URL` | backend | **Legacy single-agent** settings; retained for compatibility and used as the DeepSeek fallback. |
| `API_PORT`, `LOG_LEVEL`, `FRONTEND_URL` | backend | Server + CORS. |
| `NEXT_PUBLIC_API_BASE_URL` | frontend (build-time) | Where the browser reaches the API. Contains no secret. |

> **You can swap either model by editing env only** — no code change. Adding a
> *third* agent is a small `BaseLLMProvider` subclass plus its own env vars.

### About the model ids

Both models are served through Hugging Face **Inference Providers**, and most
routed models require a **provider suffix** on the id (`:auto` lets the router
choose):

```
KIMI_MODEL=moonshotai/Kimi-K2.7-Code:novita     # Novita is the listed provider
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-R1:auto      # or :fireworks-ai / :together
```

> **Verify current availability before deploying.** Which providers serve each
> model — and at what price — changes over time, and this can change *after* the
> code was written. On each model page open **Deploy → Inference Providers** for
> the exact, current id snippet:
> - Kimi: <https://huggingface.co/moonshotai/Kimi-K2.7-Code>
> - DeepSeek-R1: <https://huggingface.co/deepseek-ai/DeepSeek-R1>
>
> An HTTP 404 almost always means the model id or provider suffix is wrong for
> the current routing. Note that `Kimi-K2.7-Code` is a very large (1T-param MoE)
> model; provider availability and cost/latency differ substantially from
> DeepSeek-R1.

### Reasoning suppression

Both models "think" before answering. DeepSeek-R1 emits chain-of-thought inline
as `<think>…</think>` or in a `reasoning_content` field; Kimi-K2.7-Code forces a
thinking phase returned in a separate `reasoning` field. CyfyClaw strips inline
`<think>` spans and ignores separate reasoning fields, so users see **only the
final answer** for each agent.

### Using different models or self-hosted endpoints

Because the backend speaks the OpenAI `/chat/completions` protocol, you can point
either agent at vLLM, SGLang, TGI, Ollama, or another provider by changing only
that agent's `*_MODEL` / `*_BASE_URL` (and the token). No code change required.

---

## 2. Local setup (no Docker)

Requirements: **Python 3.11+** and **Node 20+**.

```bash
git clone <your-repo-url> cyfyclaw && cd cyfyclaw
cp .env.example .env          # then edit .env and set HF_TOKEN
./scripts/dev.sh              # starts backend :8000 and frontend :3000
```

Or run each side manually:

```bash
# Backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
set -a; . ../.env; set +a
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
# App: http://localhost:3000
```

Smoke-test the backend: `./scripts/smoke_test.sh http://localhost:8000`

---

## 3. GitHub setup

```bash
cd cyfyclaw
git init
git add .
git commit -m "Initial commit: CyfyClaw"
git branch -M main
git remote add origin git@github.com:<you>/cyfyclaw.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules/`, `.next/`, and virtualenvs.
**Never commit `.env`.**

---

## 4. Docker deployment (single host)

Requires Docker + the Docker Compose plugin.

```bash
cp .env.example .env    # set HF_TOKEN; set NEXT_PUBLIC_API_BASE_URL to your public API URL
docker compose up --build -d
# frontend :3000, backend :8000
docker compose logs -f
```

`NEXT_PUBLIC_API_BASE_URL` is **baked into the frontend at build time**. If you
change it, rebuild the frontend image (`docker compose build frontend`).

---

## 5. Backend deployment — Ubuntu VPS

```bash
# On the server (Ubuntu 22.04/24.04)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx
git clone <your-repo-url> cyfyclaw && cd cyfyclaw
cp .env.example .env      # set HF_TOKEN; set NEXT_PUBLIC_API_BASE_URL=https://your-domain
docker compose up --build -d
```

### Nginx + HTTPS

```bash
sudo cp nginx/cyfyclaw.conf /etc/nginx/sites-available/cyfyclaw.conf
# edit server_name to your domain
sudo ln -s /etc/nginx/sites-available/cyfyclaw.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS via Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

The provided Nginx config disables proxy buffering on `/api` and `/health` so the
streaming (SSE) responses flush token-by-token. Because it serves the frontend
and proxies the API on one origin, CORS is not needed in this setup.

---

## 6. Frontend deployment — Vercel

The frontend deploys to Vercel as a standard Next.js project.

1. Push the repo to GitHub.
2. In Vercel → **New Project** → import the repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variable **`NEXT_PUBLIC_API_BASE_URL`** = your public backend
   URL (e.g. `https://api.your-domain.com`).
5. Deploy.

The backend must be reachable over HTTPS from the browser, and its `FRONTEND_URL`
must include your Vercel origin (for CORS) — e.g.
`FRONTEND_URL=https://cyfyclaw.vercel.app`.

> Keep `HF_TOKEN` **only** on the backend host. Do not add it to Vercel.

---

## 7. Vultr deployment

Vultr is a standard Ubuntu VPS target — the steps in **§5** apply as-is:

1. Deploy a Vultr Cloud Compute instance (Ubuntu 24.04, ≥2 GB RAM).
2. Point a DNS A record at the instance IP.
3. SSH in, install Docker + Nginx, clone the repo, set `.env`, `docker compose up -d`.
4. Configure `nginx/cyfyclaw.conf` and run certbot for HTTPS.

A common split is: **frontend on Vercel**, **backend on Vultr** (holds `HF_TOKEN`).

---

## 8. Production checklist

- [ ] `.env` is set on the backend host and **not** committed.
- [ ] `HF_TOKEN` exists only on the backend; never in frontend env or client code.
- [ ] `HF_MODEL_ID` verified against the current provider list (no HTTP 404).
- [ ] `FRONTEND_URL` (CORS) lists every origin the browser will use.
- [ ] `NEXT_PUBLIC_API_BASE_URL` points at the public HTTPS API URL.
- [ ] TLS enabled (certbot) and HTTP→HTTPS redirect turned on in Nginx.
- [ ] `/health` returns `"status":"ok"` (not `"degraded"`).
- [ ] SSE streaming works end-to-end (buffering disabled at the proxy).
- [ ] Rate limiting / auth added at the proxy if exposed publicly (see note below).
- [ ] Container logs shipped to your SIEM.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/health` shows `"degraded"` | No agent configured — set `HF_TOKEN` and the agent model ids. `/health` lists each agent's `configured` flag. |
| One panel shows an error, the other works | That agent's model id/provider is wrong (see its `meta`/error text); failures are isolated per agent. |
| A panel returns HTTP 401/403 | Token invalid or missing the *Inference Providers* scope. |
| A panel returns HTTP 404 | That model isn't served by the chosen provider — fix its `:provider` suffix or use `:auto`. For Kimi try `:novita`. |
| Kimi panel errors but DeepSeek works | Kimi-K2.7-Code is huge; confirm a provider currently serves it and your token/plan has access. |
| Analyze returns HTTP 429 | Provider rate limit — retry, or pin a different provider. |
| Answer appears all at once, not streaming | Proxy is buffering — confirm `proxy_buffering off` on `/api`. |
| CORS error in browser console | Add the frontend origin to `FRONTEND_URL` and restart the backend. |
| Frontend can't reach API | `NEXT_PUBLIC_API_BASE_URL` wrong; rebuild the frontend after changing it. |
| Reasoning text (`<think>…`) leaks into output | Should be stripped server-side; if a provider streams reasoning in a non-standard field, open an issue. |

---

## Security notes

- No authentication is built in (by design — it opens straight into the
  workspace). **If you expose CyfyClaw publicly, add auth and rate limiting at the
  reverse proxy or in front of it.**
- The backend is the only component that holds the model credential.
- Uploaded/pasted rule content is sent to the configured model provider. Review
  that provider's data-handling terms against your data-classification policy
  before pasting sensitive detection logic or logs.

## License

MIT — see [LICENSE](./LICENSE).
