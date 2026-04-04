"""
Phase 2 Backend Tests: Barcode lookup + Phase 1 regression
Tests: food lookup API, product CRUD, 3-slot limit, dashboard, alerts
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TEST_EMAIL = "test@expirly.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Login and return JWT token for test user."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Login failed: {resp.status_code} {resp.text}")
    token = resp.json().get("token")
    if not token:
        pytest.skip("No token in login response")
    return token


@pytest.fixture(scope="module")
def authed(auth_token):
    """Requests session with auth header."""
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="module")
def first_niche_id(authed):
    """Get ID of first available niche for current user."""
    resp = authed.get(f"{BASE_URL}/api/niches")
    assert resp.status_code == 200, f"Niches list failed: {resp.text}"
    niches = resp.json()
    assert len(niches) > 0, "User has no niches"
    return niches[0]["id"]


# ========== Auth Tests ==========

class TestAuth:
    """Authentication endpoint regression tests."""

    def test_login_valid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        print(f"PASS: Login successful for {TEST_EMAIL}")

    def test_login_invalid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert resp.status_code == 401
        print("PASS: Invalid login returns 401")

    def test_get_me(self, authed):
        resp = authed.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"PASS: /auth/me returns user {data['email']}")

    def test_unauthenticated_request(self):
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401
        print("PASS: Unauthenticated returns 401")


# ========== Food Lookup Tests ==========

class TestFoodLookup:
    """Open Food Facts proxy lookup tests (Phase 2 core feature)."""

    def test_lookup_known_barcode_nutella(self, authed):
        """Barcode 3017624010701 should return Nutella."""
        resp = authed.get(f"{BASE_URL}/api/food/lookup?barcode=3017624010701")
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("found") is True, "Expected found=True"
        product_name = data.get("product_name", "")
        assert product_name, "product_name should not be empty"
        assert "nutella" in product_name.lower() or "Nutella" in product_name, \
            f"Expected 'Nutella' in product_name, got: {product_name}"
        assert "barcode" in data
        assert data["barcode"] == "3017624010701"
        print(f"PASS: Nutella barcode lookup → product_name='{product_name}', brand='{data.get('brand')}'")

    def test_lookup_unknown_barcode_returns_404(self, authed):
        """Unknown barcode should return 404 (not in database)."""
        resp = authed.get(f"{BASE_URL}/api/food/lookup?barcode=0000000000000")
        assert resp.status_code == 404, f"Expected 404 but got {resp.status_code}: {resp.text}"
        print("PASS: Unknown barcode returns 404")

    def test_lookup_requires_auth(self):
        """Food lookup must require authentication."""
        resp = requests.get(f"{BASE_URL}/api/food/lookup?barcode=3017624010701")
        assert resp.status_code == 401
        print("PASS: Food lookup requires auth (401 without token)")

    def test_lookup_empty_barcode_returns_400(self, authed):
        """Empty barcode should return 400."""
        resp = authed.get(f"{BASE_URL}/api/food/lookup?barcode=")
        assert resp.status_code == 400, f"Expected 400 but got {resp.status_code}: {resp.text}"
        print("PASS: Empty barcode returns 400")

    def test_lookup_response_structure(self, authed):
        """Verify response structure for a known barcode."""
        resp = authed.get(f"{BASE_URL}/api/food/lookup?barcode=3017624010701")
        assert resp.status_code == 200
        data = resp.json()
        for field in ["found", "barcode", "product_name", "brand", "category"]:
            assert field in data, f"Missing field: {field}"
        print(f"PASS: Response structure correct: {list(data.keys())}")


# ========== Niche Tests ==========

class TestNiches:
    """Niche regression tests."""

    def test_list_niches(self, authed):
        resp = authed.get(f"{BASE_URL}/api/niches")
        assert resp.status_code == 200
        niches = resp.json()
        assert isinstance(niches, list)
        assert len(niches) > 0, "User should have at least default niches"
        # Check structure
        niche = niches[0]
        for field in ["id", "niche_name", "product_count"]:
            assert field in niche, f"Missing field in niche: {field}"
        print(f"PASS: Niches listed: {[n['niche_name'] for n in niches]}")


# ========== Product Tests ==========

class TestProducts:
    """Product CRUD and limit enforcement tests (Phase 1 regression)."""

    def _future_expiry(self, days=30):
        """Return ISO datetime string for a future expiry date."""
        future = datetime.utcnow() + timedelta(days=days)
        return future.strftime("%Y-%m-%dT%H:%M:%S")

    def test_create_product_without_barcode(self, authed, first_niche_id):
        """Add a product manually without barcode."""
        resp = authed.post(f"{BASE_URL}/api/products", json={
            "niche_id": first_niche_id,
            "product_name": "TEST_ManualProduct_NoBarcode",
            "expiry_date": self._future_expiry(30),
            "reminder_offset_hours": 24,
        })
        # Could be 201 (success) or 403 (slot limit reached)
        if resp.status_code == 403:
            print(f"INFO: Slot limit reached — cannot add more products (expected if >=3 active)")
            pytest.skip("Slot limit reached, skipping product creation test")
        assert resp.status_code == 201, f"Expected 201 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["product_name"] == "TEST_ManualProduct_NoBarcode"
        assert "id" in data
        # Cleanup
        product_id = data["id"]
        print(f"PASS: Created product without barcode: id={product_id}")
        # We can't delete since it's active — just log it
        return product_id

    def test_create_product_with_barcode(self, authed, first_niche_id):
        """Add a product with barcode (simulating barcode lookup result)."""
        resp = authed.post(f"{BASE_URL}/api/products", json={
            "niche_id": first_niche_id,
            "product_name": "TEST_Nutella",
            "barcode": "3017624010701",
            "expiry_date": self._future_expiry(60),
            "reminder_offset_hours": 48,
        })
        if resp.status_code == 403:
            print("INFO: Slot limit reached — skipping barcode product test")
            pytest.skip("Slot limit reached")
        assert resp.status_code == 201, f"Expected 201 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["product_name"] == "TEST_Nutella"
        assert data.get("barcode") == "3017624010701"
        print(f"PASS: Created product with barcode: id={data['id']}")

    def test_create_product_with_past_expiry_fails(self, authed, first_niche_id):
        """Expiry date in the past should return 400."""
        past = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
        resp = authed.post(f"{BASE_URL}/api/products", json={
            "niche_id": first_niche_id,
            "product_name": "TEST_PastExpiry",
            "expiry_date": past,
            "reminder_offset_hours": 24,
        })
        assert resp.status_code == 400, f"Expected 400 but got {resp.status_code}: {resp.text}"
        print("PASS: Past expiry returns 400")

    def test_create_product_invalid_niche_fails(self, authed):
        """Invalid niche_id should return 400."""
        resp = authed.post(f"{BASE_URL}/api/products", json={
            "niche_id": "nonexistent-niche-id",
            "product_name": "TEST_BadNiche",
            "expiry_date": self._future_expiry(30),
            "reminder_offset_hours": 24,
        })
        assert resp.status_code == 400, f"Expected 400 but got {resp.status_code}: {resp.text}"
        print("PASS: Invalid niche returns 400")

    def test_slot_limit_enforcement(self, authed, first_niche_id):
        """
        Verify that 3 active products is the max for free tier.
        Tries to add products until limit is hit (or confirms limit was already hit).
        """
        # Check current product count
        dash_resp = authed.get(f"{BASE_URL}/api/dashboard")
        assert dash_resp.status_code == 200
        stats = dash_resp.json().get("stats", {})
        max_slots = stats.get("max_slots", 3)
        slots_used = stats.get("slots_used", 0)
        
        print(f"INFO: Current slots: {slots_used}/{max_slots}")

        if slots_used >= max_slots:
            # Already at limit — try adding one more and confirm 403
            resp = authed.post(f"{BASE_URL}/api/products", json={
                "niche_id": first_niche_id,
                "product_name": "TEST_OverLimit",
                "expiry_date": self._future_expiry(30),
                "reminder_offset_hours": 24,
            })
            assert resp.status_code == 403, f"Expected 403 (slot limit) but got {resp.status_code}: {resp.text}"
            assert "limit" in resp.json().get("detail", "").lower()
            print(f"PASS: Slot limit enforced correctly (got 403 when at {slots_used}/{max_slots})")
        else:
            # Fill up to max, then try one more
            created_ids = []
            for i in range(max_slots - slots_used):
                resp = authed.post(f"{BASE_URL}/api/products", json={
                    "niche_id": first_niche_id,
                    "product_name": f"TEST_SlotFill_{i}",
                    "expiry_date": self._future_expiry(30 + i),
                    "reminder_offset_hours": 24,
                })
                if resp.status_code == 201:
                    created_ids.append(resp.json()["id"])
                elif resp.status_code == 403:
                    print(f"PASS: Slot limit hit at product #{slots_used + i + 1}")
                    break

            # Now try one more
            over_resp = authed.post(f"{BASE_URL}/api/products", json={
                "niche_id": first_niche_id,
                "product_name": "TEST_OverLimit",
                "expiry_date": self._future_expiry(90),
                "reminder_offset_hours": 24,
            })
            assert over_resp.status_code == 403, f"Expected 403 but got {over_resp.status_code}: {over_resp.text}"
            print(f"PASS: Slot limit correctly enforced (403 on product #{max_slots + 1})")

    def test_get_products_list(self, authed):
        """List products for user."""
        resp = authed.get(f"{BASE_URL}/api/products")
        assert resp.status_code == 200
        products = resp.json()
        assert isinstance(products, list)
        print(f"PASS: Products listed: {len(products)} products")


# ========== Dashboard Tests ==========

class TestDashboard:
    """Dashboard regression tests (Phase 1)."""

    def test_dashboard_loads(self, authed):
        resp = authed.get(f"{BASE_URL}/api/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        for key in ["stats", "products", "expiring_soon", "fresh", "expired"]:
            assert key in data, f"Missing key in dashboard: {key}"
        print(f"PASS: Dashboard loaded with keys: {list(data.keys())}")

    def test_dashboard_stats_structure(self, authed):
        resp = authed.get(f"{BASE_URL}/api/dashboard")
        assert resp.status_code == 200
        stats = resp.json()["stats"]
        for field in ["total_active", "max_slots", "slots_used", "slots_available"]:
            assert field in stats, f"Missing stat field: {field}"
        assert stats["max_slots"] == 3, f"Free tier max should be 3, got {stats['max_slots']}"
        assert stats["slots_used"] >= 0
        print(f"PASS: Dashboard stats: {stats}")

    def test_dashboard_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/dashboard")
        assert resp.status_code == 401
        print("PASS: Dashboard requires auth")


# ========== Alerts Tests ==========

class TestAlerts:
    """Alerts endpoint regression tests (Phase 1)."""

    def test_alerts_loads(self, authed):
        resp = authed.get(f"{BASE_URL}/api/alerts")
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data
        assert "count" in data
        assert isinstance(data["alerts"], list)
        print(f"PASS: Alerts endpoint loaded: count={data['count']}")

    def test_alerts_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/alerts")
        assert resp.status_code == 401
        print("PASS: Alerts requires auth")


# ========== Health Check ==========

class TestHealth:
    def test_health_check(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"
        print(f"PASS: Health check OK: {data}")
