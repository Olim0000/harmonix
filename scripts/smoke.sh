#!/usr/bin/env bash
# Harmonix smoke tests — hits a running server on localhost:3001.
# Usage: bash scripts/smoke.sh [BASE_URL]
# Requires: curl, jq (optional, uses grep fallback), running server
set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"
JWT_SECRET="${JWT_SECRET:-38yB2TQRdj3L2ZbLz81YZQos4bk7WITM7LIDqEJ872I=}"
TEST_USER="smoke_test_$(date +%s)"
TEST_PASS="SmokePass123!"
TOKEN=""
CREATED_PLAYLIST_ID=""
LIKED=false

PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────

pass() { printf "  ✓ %s\n" "$1"; PASS=$((PASS + 1)); }
fail() { printf "  ✗ %s — %s\n" "$1" "${2:-unknown error}"; FAIL=$((FAIL + 1)); }

# HTTP helpers — return status code and body
get() {
  local url="$1"
  local auth="${2:-}"
  local header_args=()
  if [[ -n "$auth" ]]; then
    header_args=(-H "Authorization: Bearer $auth")
  fi
  local resp
  resp=$(curl -s -w '\n%{http_code}' "${header_args[@]}" "$url" 2>/dev/null) || true
  HTTP_BODY=$(echo "$resp" | sed '$d')
  HTTP_STATUS=$(echo "$resp" | tail -n1)
}

post() {
  local url="$1"
  local data="${2:-}"
  local auth="${3:-}"
  local header_args=(-H "Content-Type: application/json")
  if [[ -n "$auth" ]]; then
    header_args+=(-H "Authorization: Bearer $auth")
  fi
  local resp
  resp=$(curl -s -w '\n%{http_code}' -X POST "${header_args[@]}" -d "$data" "$url" 2>/dev/null) || true
  HTTP_BODY=$(echo "$resp" | sed '$d')
  HTTP_STATUS=$(echo "$resp" | tail -n1)
}

delete() {
  local url="$1"
  local auth="${2:-}"
  local header_args=()
  if [[ -n "$auth" ]]; then
    header_args=(-H "Authorization: Bearer $auth")
  fi
  local resp
  resp=$(curl -s -w '\n%{http_code}' -X DELETE "${header_args[@]}" "$url" 2>/dev/null) || true
  HTTP_BODY=$(echo "$resp" | sed '$d')
  HTTP_STATUS=$(echo "$resp" | tail -n1)
}

body_has() {
  local key="$1"
  local expected="${2:-}"
  if [[ -n "$expected" ]]; then
    echo "$HTTP_BODY" | grep -q "\"$key\":.*\"$expected\""
  else
    echo "$HTTP_BODY" | grep -q "\"$key\""
  fi
}

# ── Cleanup (runs on exit) ───────────────────────────────────────────────────

cleanup() {
  if [[ -n "$CREATED_PLAYLIST_ID" && -n "$TOKEN" ]]; then
    printf "\n  Cleaning up test playlist (id=%s)...\n" "$CREATED_PLAYLIST_ID"
    delete "$BASE_URL/api/playlists/$CREATED_PLAYLIST_ID" "$TOKEN" >/dev/null 2>&1 || true
  fi
  if [[ "$LIKED" == true && -n "$TOKEN" ]]; then
    printf "  Cleaning up test like...\n"
    post "$BASE_URL/api/likes" '{"itemType":"track","itemId":1}' "$TOKEN" >/dev/null 2>&1 || true
  fi
  if [[ -n "$TOKEN" ]]; then
    printf "  Cleaning up test user (%s)...\n" "$TEST_USER"
    # There's no user delete endpoint — test users are orphaned but harmless
    printf "  (note: no DELETE /api/users endpoint; test user remains)\n"
  fi
}
trap cleanup EXIT

# ── Pre-flight ───────────────────────────────────────────────────────────────

echo ""
echo "Harmonix smoke tests"
echo "===================="
echo "Server: $BASE_URL"
echo ""

printf "Checking server connectivity... "
HTTP_STATUS=""
get "$BASE_URL/api/health" || true
if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FAIL"
  echo "  Server not reachable at $BASE_URL (status: ${HTTP_STATUS:-empty})"
  echo "  Start the server first: npm run dev"
  exit 1
fi
echo "OK"
echo ""

# ── Tests ────────────────────────────────────────────────────────────────────

# 1. GET /api/health
echo "[1] GET /api/health"
get "$BASE_URL/api/health"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "status" "ok"; then
  pass "200 + status:ok"
else
  fail "expected 200 + status:ok" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 2. GET /api/source/info
echo "[2] GET /api/source/info"
get "$BASE_URL/api/source/info"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "isSource"; then
  pass "200 + isSource field present"
else
  fail "expected 200 + isSource" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 3. POST /api/auth/register
echo "[3] POST /api/auth/register"
post "$BASE_URL/api/auth/register" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "token"; then
  TOKEN=$(echo "$HTTP_BODY" | sed 's/.*"token":"\([^"]*\)".*/\1/')
  pass "200 + token received"
else
  fail "expected 200 + token" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 4. POST /api/auth/login
echo "[4] POST /api/auth/login"
post "$BASE_URL/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "token"; then
  TOKEN=$(echo "$HTTP_BODY" | sed 's/.*"token":"\([^"]*\)".*/\1/')
  pass "200 + token received"
else
  fail "expected 200 + token" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 5. GET /api/artists (auth)
echo "[5] GET /api/artists"
get "$BASE_URL/api/artists" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 6. GET /api/albums (auth)
echo "[6] GET /api/albums"
get "$BASE_URL/api/albums" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 7. GET /api/search?q=test (auth)
echo "[7] GET /api/search?q=test"
get "$BASE_URL/api/search?q=test" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 8. GET /api/likes (auth)
echo "[8] GET /api/likes"
get "$BASE_URL/api/likes" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 9. POST /api/likes — toggle like
echo "[9] POST /api/likes (toggle)"
post "$BASE_URL/api/likes" '{"itemType":"track","itemId":1}' "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "liked"; then
  LIKED=true
  pass "200 + liked field present"
else
  fail "expected 200 + liked" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 10. GET /api/playlists (auth)
echo "[10] GET /api/playlists"
get "$BASE_URL/api/playlists" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 11. POST /api/playlists
echo "[11] POST /api/playlists"
post "$BASE_URL/api/playlists" '{"name":"smoke_test_playlist"}' "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "id"; then
  CREATED_PLAYLIST_ID=$(echo "$HTTP_BODY" | sed 's/.*"id":\([0-9]*\).*/\1/')
  pass "200 + playlist created (id=$CREATED_PLAYLIST_ID)"
else
  fail "expected 200 + id" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 12. GET /api/servers (auth)
echo "[12] GET /api/servers"
get "$BASE_URL/api/servers" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]]; then
  pass "200"
else
  fail "expected 200" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 13. GET /api/player/status (auth)
echo "[13] GET /api/player/status"
get "$BASE_URL/api/player/status" "$TOKEN"
if [[ "$HTTP_STATUS" == "200" ]] && body_has "state"; then
  pass "200 + state field present"
else
  fail "expected 200 + state" "status=$HTTP_STATUS body=$HTTP_BODY"
fi

# 14. npm run build
echo "[14] npm run build"
BUILD_OUTPUT=$(npm run build 2>&1) && BUILD_EXIT=0 || BUILD_EXIT=$?
if [[ "$BUILD_EXIT" -eq 0 ]]; then
  pass "build succeeded"
else
  fail "build failed" "exit=$BUILD_EXIT"
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
