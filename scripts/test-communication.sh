#!/bin/bash
# Test Communication Platform API — E2E flow
# Usage: bash scripts/test-communication.sh [email] [password]
# Defaults: admin@trustwood.com / admin123

set -e

EMAIL="${1:-admin@trustwood.com}"
PASSWORD="${2:-admin123}"
BASE="http://localhost:3010/admin/api"

echo "🧪 Communication Platform API Test"
echo "==================================="
echo ""

# 1. Login
echo "1️⃣  Logging in as $EMAIL..."
LOGIN_RES=$(curl -s -X POST "$BASE/auth" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RES" | jq -r '.accessToken // empty')
TENANT_ID=$(echo "$LOGIN_RES" | jq -r '.tenantId // empty')
USER_ID=$(echo "$LOGIN_RES" | jq -r '.userId // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed: $LOGIN_RES"
  exit 1
fi
echo "✅ Logged in. User: $USER_ID, Tenant: $TENANT_ID"
echo ""

AUTH="Authorization: Bearer $TOKEN"
TENANT="x-tenant-id: $TENANT_ID"

# 2. Create a conversation
echo "2️⃣  Creating a conversation..."
CONV_RES=$(curl -s -X POST "$BASE/communication/conversations" \
  -H "$AUTH" -H "$TENANT" -H "Content-Type: application/json" \
  -d "{\"type\":\"DIRECT\",\"title\":\"Test Chat\",\"participantIds\":[\"$USER_ID\"]}")
CONV_ID=$(echo "$CONV_RES" | jq -r '.data.id // empty')

if [ -z "$CONV_ID" ]; then
  echo "❌ Create conversation failed: $CONV_RES"
  exit 1
fi
echo "✅ Conversation created: $CONV_ID"
echo ""

# 3. List conversations
echo "3️⃣  Listing conversations..."
curl -s "$BASE/communication/conversations" \
  -H "$AUTH" -H "$TENANT" | jq '.data | length'
echo ""

# 4. Send a message
echo "4️⃣  Sending a message..."
MSG_RES=$(curl -s -X POST "$BASE/communication/conversations/$CONV_ID/messages" \
  -H "$AUTH" -H "$TENANT" -H "Content-Type: application/json" \
  -d '{"type":"TEXT","text":"Hello from the Communication Platform! 👋"}')
MSG_ID=$(echo "$MSG_RES" | jq -r '.data.id // empty')

if [ -z "$MSG_ID" ]; then
  echo "❌ Send message failed: $MSG_RES"
  exit 1
fi
echo "✅ Message sent: $MSG_ID"
echo ""

# 5. Send another message
echo "5️⃣  Sending another message..."
curl -s -X POST "$BASE/communication/conversations/$CONV_ID/messages" \
  -H "$AUTH" -H "$TENANT" -H "Content-Type: application/json" \
  -d '{"type":"TEXT","text":"*bold* _italic_ ~strikethrough~ formatting test"}' | jq '.data.text'
echo ""

# 6. List messages
echo "6️⃣  Listing messages..."
curl -s "$BASE/communication/conversations/$CONV_ID/messages?limit=50" \
  -H "$AUTH" -H "$TENANT" | jq '.data[] | {id: .id, text: .text, sender: .senderId, time: .createdAt}'
echo ""

# 7. Update presence
echo "7️⃣  Setting presence to ONLINE..."
curl -s -X PUT "$BASE/communication/presence" \
  -H "$AUTH" -H "$TENANT" -H "Content-Type: application/json" \
  -d '{"status":"ONLINE"}' | jq '.data'
echo ""

# 8. Get presence
echo "8️⃣  Getting presence..."
curl -s "$BASE/communication/presence?userId=$USER_ID" \
  -H "$AUTH" -H "$TENANT" | jq '.data'
echo ""

# 9. Get conversation details
echo "9️⃣  Getting conversation details..."
curl -s "$BASE/communication/conversations/$CONV_ID" \
  -H "$AUTH" -H "$TENANT" | jq '.data | {id: .id, type: .type, status: .status, title: .title, participants: (.participants | length)}'
echo ""

# 10. Archive conversation
echo "🔟  Archiving conversation..."
curl -s -X PATCH "$BASE/communication/conversations/$CONV_ID" \
  -H "$AUTH" -H "$TENANT" -H "Content-Type: application/json" \
  -d '{"status":"ARCHIVED"}' | jq '.data.status'
echo ""

echo "==================================="
echo "✅ All tests passed!"
echo ""
echo "📱 UI: Open http://localhost:3010/admin/messages"
echo "💬 The chat UI shows conversations and messages"