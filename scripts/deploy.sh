#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.gcp"
BACKEND_SVC="llm-kb-backend"
AR_REPO="llm-knowledge-chatbot"
SA_NAME="llm-kb-runner"

TARGET=""
ACTIVE_ACCOUNT=""
GCP_PROJECT=""
GCP_REGION=""
TAG=""
AR_HOST=""
BACKEND_IMAGE=""
SA_EMAIL=""
BACKEND_URL=""
_CP=0
_CF=0

# ── Helpers ───────────────────────────────────────────────────────────────────

_chk() {
  local n="$1" label="$2" ok="$3" detail="${4:-}"
  if [[ "$ok" == "1" ]]; then
    printf '  [%s] PASS  %s%s\n' "$n" "$label" "${detail:+  ($detail)}"
    _CP=$(( _CP + 1 ))
  else
    printf '  [%s] FAIL  %s%s\n' "$n" "$label" "${detail:+  — $detail}"
    _CF=$(( _CF + 1 ))
  fi
}

_fetch() {
  local url="$1" out
  out=$(curl -sf "$url" --max-time 20 2>/dev/null)
  if [[ -z "$out" ]]; then
    printf '    (no response — retrying in 5 s...)\n'
    sleep 5
    out=$(curl -sf "$url" --max-time 20 2>/dev/null)
  fi
  printf '%s' "$out"
}

_upsert_secret() {
  local _name="$1" _val="$2"
  [[ -z "$_val" ]] && return
  if gcloud secrets describe "$_name" --project="$GCP_PROJECT" &>/dev/null; then
    echo -n "$_val" | gcloud secrets versions add "$_name" --data-file=- --project="$GCP_PROJECT"
  else
    echo -n "$_val" | gcloud secrets create "$_name" --data-file=- --project="$GCP_PROJECT"
    gcloud secrets add-iam-policy-binding "$_name" --project="$GCP_PROJECT" \
      --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true
  fi
}

# ── Menu ──────────────────────────────────────────────────────────────────────

_prompt_menu() {
  local _local_running=0 _gcp_deployed=0
  lsof -ti:8000 >/dev/null 2>&1 && _local_running=1 || true
  [[ -f "$ENV_FILE" ]] && _gcp_deployed=1 || true

  printf '\n=== llm-knowledge-chatbot ===\n\n'
  printf '  [1] Local  — uvicorn on localhost:8000'
  (( _local_running )) && printf ' [running]' || printf ' [not detected]'
  printf '\n'
  printf '  [2] Cloud  — GCP Cloud Run  (~$0/mo scales-to-zero)'
  (( _gcp_deployed )) && printf ' [deployed]' || printf ' [not deployed]'
  printf '\n'
  printf '\nChoice [1/2, default 2]: '
  read -r _MODE
  case "${_MODE:-2}" in
    1) TARGET="local" ;;
    *) TARGET="cloud" ;;
  esac
}

# ── Local ─────────────────────────────────────────────────────────────────────

_deploy_local() {
  local _snapshots="${SNAPSHOTS_PATH:-$ROOT/../hackathon-knowledge-kit-participant/snapshots}"
  [[ -d "$_snapshots" ]] || { printf 'Snapshots not found at %s\nSet SNAPSHOTS_PATH.\n' "$_snapshots" >&2; exit 1; }

  cd "$ROOT/api"
  [[ -d .venv ]] || python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt

  printf '\nStarting uvicorn on :8000...\n'
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  SNAPSHOTS_PATH="$_snapshots" \
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
}

# ── gcloud auth ───────────────────────────────────────────────────────────────

_check_gcloud_auth() {
  if ! command -v gcloud >/dev/null 2>&1; then
    command -v brew >/dev/null 2>&1 && brew install --cask google-cloud-sdk || \
      { printf 'Install gcloud: https://cloud.google.com/sdk/docs/install\n' >&2; exit 1; }
  fi
  ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 || true)
  if [[ -z "$ACTIVE_ACCOUNT" ]]; then
    gcloud auth login
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 || true)
  fi
  printf '  Authenticated as: %s\n' "$ACTIVE_ACCOUNT"
}

# ── Project / region ──────────────────────────────────────────────────────────

_resolve_project() {
  [[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
  local _p _r
  _p=$(gcloud config get-value project 2>/dev/null || true)
  GCP_PROJECT="${_p:-${GCP_PROJECT:-}}"
  [[ -n "$GCP_PROJECT" ]] || { printf 'Set a project: gcloud config set project <id>\n' >&2; exit 1; }
  _r=$(gcloud config get-value compute/region 2>/dev/null || true)
  GCP_REGION="${_r:-${GCP_REGION:-us-central1}}"
  printf '  Project: %s  Region: %s\n' "$GCP_PROJECT" "$GCP_REGION"
}

# ── Service account + secrets ─────────────────────────────────────────────────

_ensure_service_account() {
  SA_EMAIL="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$GCP_PROJECT" &>/dev/null; then
    printf '  Creating service account %s...\n' "$SA_EMAIL"
    gcloud iam service-accounts create "$SA_NAME" \
      --display-name="LLM KB Cloud Run SA" \
      --project="$GCP_PROJECT"
  fi
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true
}

_setup_secrets() {
  gcloud services enable secretmanager.googleapis.com --project "$GCP_PROJECT" --quiet 2>/dev/null

  [[ -f "$ROOT/.env" ]] && source "$ROOT/.env"
  for _sib in "$ROOT"/../*/.env; do
    [[ -f "$_sib" ]] || continue
    [[ -z "${ANTHROPIC_API_KEY:-}" ]] && \
      ANTHROPIC_API_KEY=$(grep "^ANTHROPIC_API_KEY=" "$_sib" 2>/dev/null | cut -d= -f2- | head -1 || true)
  done

  if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    printf '  ANTHROPIC_API_KEY (required): ' >&2
    read -rs ANTHROPIC_API_KEY; printf '\n' >&2
  fi
  _upsert_secret llm-kb-anthropic-key "$ANTHROPIC_API_KEY"
}

# ── Build image ───────────────────────────────────────────────────────────────

_build_image() {
  gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    --project "$GCP_PROJECT" --quiet

  if ! gcloud artifacts repositories describe "$AR_REPO" \
       --project="$GCP_PROJECT" --location="$GCP_REGION" &>/dev/null; then
    printf '  Creating Artifact Registry repo %s...\n' "$AR_REPO"
    gcloud artifacts repositories create "$AR_REPO" \
      --repository-format=docker \
      --location="$GCP_REGION" \
      --project="$GCP_PROJECT"
  fi

  AR_HOST="${GCP_REGION}-docker.pkg.dev"
  local _GIT_HASH
  _GIT_HASH=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)
  TAG="${_GIT_HASH:+${_GIT_HASH}-}$(date +%Y%m%d%H%M%S)"
  BACKEND_IMAGE="${AR_HOST}/${GCP_PROJECT}/${AR_REPO}/${BACKEND_SVC}:${TAG}"

  local _snapshots="${SNAPSHOTS_PATH:-$ROOT/../hackathon-knowledge-kit-participant/snapshots}"
  [[ -d "$_snapshots" ]] || { printf 'Snapshots not found at %s\nSet SNAPSHOTS_PATH.\n' "$_snapshots" >&2; exit 1; }

  local _build_ctx
  _build_ctx=$(mktemp -d)
  trap 'rm -rf "${_build_ctx:-}"' EXIT

  cp -r "$ROOT/api/." "$_build_ctx/"
  cp -r "$_snapshots" "$_build_ctx/snapshots"

  printf '  Building %s (bundling snapshots)...\n' "$BACKEND_SVC"
  gcloud builds submit --tag "$BACKEND_IMAGE" --project "$GCP_PROJECT" "$_build_ctx"
}

# ── Deploy to Cloud Run ───────────────────────────────────────────────────────

_deploy_cloud_run() {
  printf '  Deploying %s...\n' "$BACKEND_SVC"
  gcloud run deploy "$BACKEND_SVC" \
    --image="$BACKEND_IMAGE" \
    --region="$GCP_REGION" \
    --project="$GCP_PROJECT" \
    --service-account="$SA_EMAIL" \
    --set-secrets="ANTHROPIC_API_KEY=llm-kb-anthropic-key:latest" \
    --allow-unauthenticated \
    --min-instances=0 \
    --memory=1Gi \
    --port=8080 \
    --timeout=300 \
    --quiet

  BACKEND_URL=$(gcloud run services describe "$BACKEND_SVC" \
    --region="$GCP_REGION" --project="$GCP_PROJECT" \
    --format="value(status.url)")
  printf '  Backend: %s\n' "$BACKEND_URL"
}

# ── Wire CF Worker ────────────────────────────────────────────────────────────

_set_worker_secret() {
  printf '\nSet API_URL on CF Worker? [Y/n]: '
  read -r _ANS
  [[ "${_ANS:-Y}" =~ ^[Nn]$ ]] && return 0
  printf '  Running: wrangler secret put API_URL\n'
  cd "$ROOT/worker"
  [[ -d node_modules ]] || npm install --silent
  printf '%s' "$BACKEND_URL" | npx wrangler secret put API_URL
  printf '  CF Worker API_URL set.\n'
}

# ── Persist config ────────────────────────────────────────────────────────────

_persist_config() {
  cat > "$ENV_FILE" <<ENVEOF
GCP_PROJECT=${GCP_PROJECT}
GCP_REGION=${GCP_REGION}
AR_REPO=${AR_REPO}
BACKEND_URL=${BACKEND_URL}
ENVEOF

  printf '\nllm-knowledge-chatbot live\n'
  printf '  API:       %s\n' "$BACKEND_URL"
  printf '  UI:        https://llm-knowledge-chatbot.gangulybikramjit.workers.dev\n'
  printf '  Cost:      ~$0/mo  (Cloud Run scales-to-zero)\n'
  printf '  Tear down: ./scripts/infra-down.sh\n'
}

# ── Post-deploy check ─────────────────────────────────────────────────────────

_post_deploy_check() {
  printf '\nRun health check? [y/N]: '
  read -r _SANITY
  [[ "$_SANITY" =~ ^[Yy]$ ]] || return 0

  printf '\n=== post-deploy check ===\n'
  printf '  (cold-start may take ~15 s)\n\n'

  local _r
  _r=$(_fetch "${BACKEND_URL}/health")
  local _status
  _status=$(printf '%s' "$_r" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
  [[ "$_status" == "ok" ]] \
    && _chk 1 "GET /health" 1 \
    || _chk 1 "GET /health" 0 "response: ${_r:-no response}"

  printf '\n  %d passed  %d failed\n' "$_CP" "$_CF"
}

# ── Main ──────────────────────────────────────────────────────────────────────

_prompt_menu
if [[ "$TARGET" == "local" ]]; then
  _deploy_local
else
  _check_gcloud_auth
  _resolve_project
  _ensure_service_account
  _setup_secrets
  _build_image
  _deploy_cloud_run
  _persist_config
  _set_worker_secret
  _post_deploy_check
fi
