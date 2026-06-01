#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3010}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@simhapurifresh.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
TENANT_SLUG="${TENANT_SLUG:-simhapuri-fresh}"
E2E_PASSWORD="${E2E_PASSWORD:-Pass@12345}"

TS="$(date +%s)"
MANAGER_EMAIL="manager.${TS}@simhapurifresh.com"
USER_EMAIL="user.${TS}@simhapurifresh.com"
TEMP_INVITE_EMAIL="invitecheck.${TS}@simhapurifresh.com"

TMP_DIR="$(mktemp -d)"
RESP_FILE="$TMP_DIR/resp.json"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0
LAST_TOKEN=""

log_pass() {
  PASS=$((PASS + 1))
  echo "[PASS] $1" >&2
}

log_fail() {
  FAIL=$((FAIL + 1))
  echo "[FAIL] $1" >&2
}

request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local tenant_id="${4:-}"
  local body="${5:-}"

  local headers=("-H" "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    headers+=("-H" "Authorization: Bearer $token")
  fi
  if [[ -n "$tenant_id" ]]; then
    headers+=("-H" "x-tenant-id: $tenant_id")
  fi

  if [[ -n "$body" ]]; then
    RESP_CODE=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$BASE_URL$path" "${headers[@]}" --data "$body")
  else
    RESP_CODE=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$BASE_URL$path" "${headers[@]}")
  fi

  RESP_BODY="$(cat "$RESP_FILE")"
}

json_get() {
  local expr="$1"
  printf "%s" "$RESP_BODY" | node -e 'const fs=require("fs"); const text=fs.readFileSync(0,"utf8"); if(!text){process.exit(2)}; let o; try{o=JSON.parse(text)}catch{process.exit(2)}; const expr=process.argv[1]; const fn=new Function("o", `return o${expr}`); const v=fn(o); if(v===undefined || v===null){process.exit(2)}; process.stdout.write(String(v));' "$expr" 2>/dev/null
}

expect_code() {
  local name="$1"
  local regex="$2"
  if [[ "$RESP_CODE" =~ ^($regex)$ ]]; then
    log_pass "$name (HTTP $RESP_CODE)"
    return 0
  fi
  log_fail "$name (HTTP $RESP_CODE)"
  printf "%s\n" "$RESP_BODY" | cut -c1-240 >&2
  return 1
}

register_and_login() {
  local name="$1"
  local email="$2"
  local pass="$3"

  request POST "/api/auth?action=register" "" "" "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$pass\"}"
  if [[ "$RESP_CODE" =~ ^(201|409)$ ]]; then
    log_pass "Register $email (HTTP $RESP_CODE)"
  else
    log_fail "Register $email (HTTP $RESP_CODE)"
    printf "%s\n" "$RESP_BODY" | cut -c1-240 >&2
  fi

  request POST "/api/auth?action=login" "" "" "{\"email\":\"$email\",\"password\":\"$pass\"}"
  expect_code "Login $email" "200" || return 1

  LAST_TOKEN="$(json_get "?.data?.accessToken")"
}

invite_and_join_tenant() {
  local email="$1"
  local role="$2"
  local user_token="$3"

  request POST "/api/tenants/$TENANT_ID/users" "$ADMIN_TOKEN" "$TENANT_ID" "{\"email\":\"$email\",\"role\":\"$role\"}"

  if [[ "$RESP_CODE" == "201" ]]; then
    log_pass "Invite $email as $role"
    local invite_token
    invite_token="$(json_get "?.data?.inviteToken")"
    if [[ -z "$invite_token" ]]; then
      log_fail "Invite token missing for $email"
      return 1
    fi

    request POST "/api/invitations/$invite_token" "$user_token" "$TENANT_ID" "{}"
    expect_code "Accept invitation for $email" "200|409" || return 1
  elif [[ "$RESP_CODE" == "409" ]]; then
    log_pass "$email already member"
  else
    log_fail "Invite $email failed (HTTP $RESP_CODE)"
    printf "%s\n" "$RESP_BODY" | cut -c1-240 >&2
    return 1
  fi

  request POST "/api/auth?action=switch-tenant" "$user_token" "" "{\"tenantId\":\"$TENANT_ID\"}"
  expect_code "Switch tenant for $email" "200" || return 1

  LAST_TOKEN="$(json_get "?.data?.accessToken")"
}

echo "=== E2E User-Based Flows ==="
echo "Base URL: $BASE_URL"

# 1) Admin login
request POST "/api/auth?action=login" "" "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"tenantSlug\":\"$TENANT_SLUG\"}"
expect_code "Admin login" "200" || exit 1
ADMIN_TOKEN="$(json_get "?.data?.accessToken")"
TENANT_ID="$(json_get "?.data?.tenant?.id")"

if [[ -z "$ADMIN_TOKEN" || -z "$TENANT_ID" ]]; then
  echo "Failed to get admin token or tenant id"
  exit 1
fi

# 2) Create manager + user accounts
register_and_login "E2E Manager" "$MANAGER_EMAIL" "$E2E_PASSWORD" || exit 1
MANAGER_BASE_TOKEN="$LAST_TOKEN"
register_and_login "E2E User" "$USER_EMAIL" "$E2E_PASSWORD" || exit 1
USER_BASE_TOKEN="$LAST_TOKEN"

# 3) Invite and join seeded tenant
invite_and_join_tenant "$MANAGER_EMAIL" "MANAGER" "$MANAGER_BASE_TOKEN" || exit 1
MANAGER_TOKEN="$LAST_TOKEN"
invite_and_join_tenant "$USER_EMAIL" "USER" "$USER_BASE_TOKEN" || exit 1
USER_TOKEN="$LAST_TOKEN"

# 4) Admin-only invite gate check (manager must fail)
request POST "/api/tenants/$TENANT_ID/users" "$MANAGER_TOKEN" "$TENANT_ID" "{\"email\":\"$TEMP_INVITE_EMAIL\",\"role\":\"USER\"}"
expect_code "Manager cannot invite tenant users" "403"

# 5) Member list visibility
request GET "/api/tenants/$TENANT_ID/users?limit=100" "$ADMIN_TOKEN" "$TENANT_ID"
expect_code "Admin list tenant users" "200"

# 6) Manager and user permission checks on vendor lifecycle
request POST "/api/vendors" "$MANAGER_TOKEN" "$TENANT_ID" "{\"name\":\"Role E2E Vendor $TS\",\"email\":\"role-vendor-$TS@test.com\"}"
expect_code "Manager create vendor" "201"
VENDOR_ID="$(json_get "?.data?.id")"

request PATCH "/api/vendors/$VENDOR_ID" "$MANAGER_TOKEN" "$TENANT_ID" "{\"phone\":\"9000000001\"}"
expect_code "Manager update vendor" "200"

request PATCH "/api/vendors/$VENDOR_ID" "$USER_TOKEN" "$TENANT_ID" "{\"phone\":\"9000000002\"}"
expect_code "User cannot update vendor" "403"

request DELETE "/api/vendors/$VENDOR_ID" "$MANAGER_TOKEN" "$TENANT_ID"
expect_code "Manager cannot delete vendor" "403"

request DELETE "/api/vendors/$VENDOR_ID" "$ADMIN_TOKEN" "$TENANT_ID"
expect_code "Admin delete vendor" "200"

# 7) User read-only checks
request GET "/api/vendors?limit=10" "$USER_TOKEN" "$TENANT_ID"
expect_code "User can read vendors list" "200"

request GET "/api/orders?limit=10" "$USER_TOKEN" "$TENANT_ID"
expect_code "User can read orders list" "200"

# 8) PO approval authorization checks (USER denied, MANAGER allowed)
request GET "/api/products?limit=1" "$MANAGER_TOKEN" "$TENANT_ID"
expect_code "Manager list products" "200"
PRODUCT_ID="$(json_get "?.data?.[0]?.id")"
PRODUCT_NAME="$(json_get "?.data?.[0]?.name")"
PRODUCT_PRICE="$(json_get "?.data?.[0]?.costPrice")"

if [[ -z "$PRODUCT_ID" || -z "$PRODUCT_NAME" || -z "$PRODUCT_PRICE" ]]; then
  echo "Product seed data not found; run seed first."
  exit 1
fi

request POST "/api/vendors" "$MANAGER_TOKEN" "$TENANT_ID" "{\"name\":\"PO Vendor $TS\"}"
expect_code "Manager create PO vendor" "201"
PO_VENDOR_ID="$(json_get "?.data?.id")"

NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
request POST "/api/purchase-orders" "$MANAGER_TOKEN" "$TENANT_ID" "{\"vendorId\":\"$PO_VENDOR_ID\",\"date\":\"$NOW_ISO\",\"items\":[{\"productId\":\"$PRODUCT_ID\",\"productName\":\"$PRODUCT_NAME\",\"quantity\":2,\"unitPrice\":$PRODUCT_PRICE}]}"
expect_code "Manager create purchase order" "201"
PO_ID="$(json_get "?.data?.id")"

request PATCH "/api/purchase-orders/$PO_ID?action=submit" "$MANAGER_TOKEN" "$TENANT_ID" "{}"
expect_code "Manager submit purchase order" "200"

request PATCH "/api/purchase-orders/$PO_ID?action=approve" "$USER_TOKEN" "$TENANT_ID" "{}"
expect_code "User cannot approve purchase order" "403"

request PATCH "/api/purchase-orders/$PO_ID?action=approve" "$MANAGER_TOKEN" "$TENANT_ID" "{}"
expect_code "Manager approve purchase order" "200"

echo
echo "=== SUMMARY ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
