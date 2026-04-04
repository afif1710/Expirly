#!/bin/bash
# Expirly Backend API Test Script
# ===============================

BASE_URL="https://niche-keeper.preview.emergentagent.com/api"
TEST_EMAIL="testbackend3@expirly.com"
TEST_PASSWORD="testpass123"
TEST_NAME="Backend Tester 3"

echo "🧪 Starting Expirly Backend API Tests"
echo "=================================================="

# Test 1: Register new user
echo "📝 Testing user registration..."
REGISTER_RESPONSE=$(curl -s -k -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"$TEST_NAME\"}")

echo "Register Response: $REGISTER_RESPONSE"

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ FAIL: Auth - Register endpoint (no token received)"
    exit 1
else
    echo "✅ PASS: Auth - Register endpoint"
fi

# Test 2: Duplicate registration
echo "📝 Testing duplicate registration..."
DUPLICATE_RESPONSE=$(curl -s -k -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"$TEST_NAME\"}")

if echo "$DUPLICATE_RESPONSE" | grep -q "already exists\|duplicate"; then
    echo "✅ PASS: Auth - Duplicate registration check"
else
    echo "❌ FAIL: Auth - Duplicate registration check"
fi

# Test 3: Get current user
echo "📝 Testing get current user..."
ME_RESPONSE=$(curl -s -k -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ME_RESPONSE" | grep -q "$TEST_EMAIL"; then
    echo "✅ PASS: Auth - Get current user"
else
    echo "❌ FAIL: Auth - Get current user"
fi

# Test 4: List niches (should have 4 defaults)
echo "📝 Testing list niches..."
NICHES_RESPONSE=$(curl -s -k -X GET "$BASE_URL/niches" \
  -H "Authorization: Bearer $TOKEN")

NICHE_COUNT=$(echo "$NICHES_RESPONSE" | grep -o '"niche_name"' | wc -l)
if [ "$NICHE_COUNT" -ge 4 ]; then
    echo "✅ PASS: Niche - List niches (found $NICHE_COUNT niches)"
    # Extract first niche ID for product testing
    NICHE_ID=$(echo $NICHES_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo "❌ FAIL: Niche - List niches (expected at least 4, got $NICHE_COUNT)"
fi

# Test 5: Create custom niche
echo "📝 Testing create custom niche..."
CUSTOM_NICHE_RESPONSE=$(curl -s -k -X POST "$BASE_URL/niches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"niche_name": "Test Custom Niche"}')

if echo "$CUSTOM_NICHE_RESPONSE" | grep -q "Test Custom Niche"; then
    echo "✅ PASS: Niche - Create custom niche"
else
    echo "❌ FAIL: Niche - Create custom niche"
fi

# Test 6: Create product
echo "📝 Testing create product..."
FUTURE_DATE=$(date -d "+30 days" -u +"%Y-%m-%dT%H:%M:%SZ")
PRODUCT_RESPONSE=$(curl -s -k -X POST "$BASE_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"niche_id\": \"$NICHE_ID\", \"product_name\": \"Test Product 1\", \"expiry_date\": \"$FUTURE_DATE\", \"reminder_offset_hours\": 24}")

if echo "$PRODUCT_RESPONSE" | grep -q "Test Product 1"; then
    echo "✅ PASS: Product - Create product"
    PRODUCT_ID=$(echo $PRODUCT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo "❌ FAIL: Product - Create product"
    echo "Response: $PRODUCT_RESPONSE"
fi

# Test 7: Create 2 more products to test 3-slot limit
echo "📝 Testing 3-slot limit..."
for i in 2 3; do
    PRODUCT_RESPONSE=$(curl -s -k -X POST "$BASE_URL/products" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"niche_id\": \"$NICHE_ID\", \"product_name\": \"Test Product $i\", \"expiry_date\": \"$FUTURE_DATE\", \"reminder_offset_hours\": 24}")
    
    if ! echo "$PRODUCT_RESPONSE" | grep -q "Test Product $i"; then
        echo "❌ FAIL: Product - 3-slot limit setup (failed to create product $i)"
        exit 1
    fi
done

# Test 8: Try to create 4th product (should fail with 403)
echo "📝 Testing 4th product creation (should fail)..."
FOURTH_PRODUCT_RESPONSE=$(curl -s -k -w "%{http_code}" -X POST "$BASE_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"niche_id\": \"$NICHE_ID\", \"product_name\": \"Test Product 4\", \"expiry_date\": \"$FUTURE_DATE\", \"reminder_offset_hours\": 24}")

if echo "$FOURTH_PRODUCT_RESPONSE" | grep -q "403"; then
    echo "✅ PASS: Product - 3-slot free tier limit"
else
    echo "❌ FAIL: Product - 3-slot free tier limit"
    echo "Response: $FOURTH_PRODUCT_RESPONSE"
fi

# Test 9: Try to delete active product (should fail with 403)
echo "📝 Testing delete active product (should fail)..."
if [ ! -z "$PRODUCT_ID" ]; then
    DELETE_RESPONSE=$(curl -s -k -w "%{http_code}" -X DELETE "$BASE_URL/products/$PRODUCT_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$DELETE_RESPONSE" | grep -q "403"; then
        echo "✅ PASS: Product - Delete before expiry"
    else
        echo "❌ FAIL: Product - Delete before expiry"
        echo "Response: $DELETE_RESPONSE"
    fi
else
    echo "❌ FAIL: Product - Delete before expiry (no product ID available)"
fi

# Test 10: Update reminder
echo "📝 Testing update reminder..."
if [ ! -z "$PRODUCT_ID" ]; then
    REMINDER_RESPONSE=$(curl -s -k -X PATCH "$BASE_URL/products/$PRODUCT_ID/reminder" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"reminder_offset_hours": 48}')
    
    if echo "$REMINDER_RESPONSE" | grep -q '"reminder_offset_hours":48'; then
        echo "✅ PASS: Product - Update reminder only"
    else
        echo "❌ FAIL: Product - Update reminder only"
        echo "Response: $REMINDER_RESPONSE"
    fi
else
    echo "❌ FAIL: Product - Update reminder only (no product ID available)"
fi

# Test 11: Dashboard
echo "📝 Testing dashboard..."
DASHBOARD_RESPONSE=$(curl -s -k -X GET "$BASE_URL/dashboard" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DASHBOARD_RESPONSE" | grep -q '"stats"' && echo "$DASHBOARD_RESPONSE" | grep -q '"products"'; then
    echo "✅ PASS: Dashboard endpoint"
else
    echo "❌ FAIL: Dashboard endpoint"
    echo "Response: $DASHBOARD_RESPONSE"
fi

# Test 12: Alerts
echo "📝 Testing alerts..."
ALERTS_RESPONSE=$(curl -s -k -X GET "$BASE_URL/alerts" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ALERTS_RESPONSE" | grep -q '"alerts"' && echo "$ALERTS_RESPONSE" | grep -q '"count"'; then
    echo "✅ PASS: Alerts endpoint"
else
    echo "❌ FAIL: Alerts endpoint"
    echo "Response: $ALERTS_RESPONSE"
fi

echo "=================================================="
echo "📊 Backend API Testing Complete"
echo "=================================================="