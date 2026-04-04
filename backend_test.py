#!/usr/bin/env python3
"""
Expirly Backend API Test Suite
=============================
Comprehensive testing of all backend endpoints with business rule validation.
"""

import requests
import json
from datetime import datetime, timedelta, timezone
import uuid
import urllib3

# Suppress SSL warnings for testing
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration
BASE_URL = "https://niche-keeper.preview.emergentagent.com/api"
TEST_EMAIL = "testbackend@expirly.com"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Backend Tester"

class ExpirlyAPITester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.niches = []
        self.products = []
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        if self.token:
            default_headers["Authorization"] = f"Bearer {self.token}"
        if headers:
            default_headers.update(headers)
            
        try:
            if method == "GET":
                response = requests.get(url, headers=default_headers, verify=False, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=default_headers, verify=False, timeout=30)
            elif method == "PATCH":
                response = requests.patch(url, json=data, headers=default_headers, verify=False, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=default_headers, verify=False, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def test_auth_register(self):
        """Test user registration and default niche seeding"""
        data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if not response:
            self.log_test("Auth - Register endpoint", False, "Request failed")
            return False
            
        if response.status_code in [200, 201]:
            result = response.json()
            if "user" in result and "token" in result:
                self.token = result["token"]
                self.user_id = result["user"]["id"]
                self.log_test("Auth - Register endpoint", True, "User registered successfully with token")
                return True
            else:
                self.log_test("Auth - Register endpoint", False, "Missing user or token in response")
                return False
        elif response.status_code == 400:
            # User might already exist, try to login instead
            self.log_test("Auth - Register endpoint", True, "User already exists (400 expected for duplicate)")
            return self.test_auth_login()
        else:
            self.log_test("Auth - Register endpoint", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_auth_duplicate_register(self):
        """Test duplicate email registration returns 400"""
        data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if not response:
            self.log_test("Auth - Duplicate registration check", False, "Request failed")
            return False
            
        if response.status_code == 400:
            self.log_test("Auth - Duplicate registration check", True, "Correctly returns 400 for duplicate email")
            return True
        else:
            self.log_test("Auth - Duplicate registration check", False, f"Expected 400, got {response.status_code}")
            return False
    
    def test_auth_login(self):
        """Test user login"""
        data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", data)
        
        if not response:
            self.log_test("Auth - Login endpoint", False, "Request failed")
            return False
            
        if response.status_code == 200:
            result = response.json()
            if "user" in result and "token" in result:
                self.token = result["token"]
                self.user_id = result["user"]["id"]
                self.log_test("Auth - Login endpoint", True, "Login successful with token")
                return True
            else:
                self.log_test("Auth - Login endpoint", False, "Missing user or token in response")
                return False
        else:
            self.log_test("Auth - Login endpoint", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_auth_me(self):
        """Test get current user"""
        response = self.make_request("GET", "/auth/me")
        
        if not response:
            self.log_test("Auth - Get current user", False, "Request failed")
            return False
            
        if response.status_code == 200:
            user = response.json()
            if "id" in user and "email" in user:
                self.log_test("Auth - Get current user", True, f"User data retrieved: {user['email']}")
                return True
            else:
                self.log_test("Auth - Get current user", False, "Missing user fields in response")
                return False
        else:
            self.log_test("Auth - Get current user", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_niches_list(self):
        """Test list niches (should have 4 defaults after register)"""
        response = self.make_request("GET", "/niches")
        
        if not response:
            self.log_test("Niche - List niches", False, "Request failed")
            return False
            
        if response.status_code == 200:
            niches = response.json()
            self.niches = niches
            if len(niches) >= 4:
                default_names = [n["niche_name"] for n in niches if n["niche_type"] == "default"]
                expected_defaults = ["Fridge", "Pantry", "Medicine", "Cosmetics"]
                if all(name in default_names for name in expected_defaults):
                    self.log_test("Niche - List niches", True, f"Found {len(niches)} niches with 4 defaults")
                    return True
                else:
                    self.log_test("Niche - List niches", False, f"Missing default niches. Found: {default_names}")
                    return False
            else:
                self.log_test("Niche - List niches", False, f"Expected at least 4 niches, got {len(niches)}")
                return False
        else:
            self.log_test("Niche - List niches", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_niches_create_custom(self):
        """Test create custom niche"""
        data = {"niche_name": "Test Custom Niche"}
        
        response = self.make_request("POST", "/niches", data)
        
        if not response:
            self.log_test("Niche - Create custom niche", False, "Request failed")
            return False
            
        if response.status_code in [200, 201]:
            niche = response.json()
            if niche["niche_type"] == "custom" and niche["niche_name"] == "Test Custom Niche":
                self.niches.append(niche)
                self.log_test("Niche - Create custom niche", True, "Custom niche created successfully")
                return True
            else:
                self.log_test("Niche - Create custom niche", False, "Invalid niche data returned")
                return False
        else:
            self.log_test("Niche - Create custom niche", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_niches_duplicate_name(self):
        """Test duplicate niche name returns 400"""
        data = {"niche_name": "Test Custom Niche"}  # Same as previous test
        
        response = self.make_request("POST", "/niches", data)
        
        if not response:
            self.log_test("Niche - Duplicate name check", False, "Request failed")
            return False
            
        if response.status_code == 400:
            self.log_test("Niche - Duplicate name check", True, "Correctly returns 400 for duplicate name")
            return True
        else:
            self.log_test("Niche - Duplicate name check", False, f"Expected 400, got {response.status_code}")
            return False
    
    def test_products_create(self):
        """Test create product under a niche"""
        if not self.niches:
            self.log_test("Product - Create product", False, "No niches available")
            return False
            
        niche_id = self.niches[0]["id"]
        future_date = datetime.now(timezone.utc) + timedelta(days=30)
        
        data = {
            "niche_id": niche_id,
            "product_name": "Test Product 1",
            "barcode": "123456789",
            "product_type": "Food",
            "expiry_date": future_date.isoformat(),
            "reminder_offset_hours": 24
        }
        
        response = self.make_request("POST", "/products", data)
        
        if not response:
            self.log_test("Product - Create product", False, "Request failed")
            return False
            
        if response.status_code in [200, 201]:
            product = response.json()
            if "id" in product and product["product_name"] == "Test Product 1":
                self.products.append(product)
                self.log_test("Product - Create product", True, "Product created successfully")
                return True
            else:
                self.log_test("Product - Create product", False, "Invalid product data returned")
                return False
        else:
            self.log_test("Product - Create product", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_products_3_slot_limit(self):
        """Test 3-slot limit: create 3 products successfully, then 4th should return 403"""
        if not self.niches:
            self.log_test("Product - 3-slot free tier limit", False, "No niches available")
            return False
            
        niche_id = self.niches[0]["id"]
        future_date = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Create products 2 and 3 (we already have 1 from previous test)
        for i in range(2, 4):
            data = {
                "niche_id": niche_id,
                "product_name": f"Test Product {i}",
                "expiry_date": future_date.isoformat(),
                "reminder_offset_hours": 24
            }
            
            response = self.make_request("POST", "/products", data)
            
            if not response or response.status_code not in [200, 201]:
                self.log_test("Product - 3-slot free tier limit", False, f"Failed to create product {i}")
                return False
            
            self.products.append(response.json())
        
        # Now try to create the 4th product - should fail with 403
        data = {
            "niche_id": niche_id,
            "product_name": "Test Product 4 (Should Fail)",
            "expiry_date": future_date.isoformat(),
            "reminder_offset_hours": 24
        }
        
        response = self.make_request("POST", "/products", data)
        
        if not response:
            self.log_test("Product - 3-slot free tier limit", False, "Request failed")
            return False
            
        if response.status_code == 403:
            self.log_test("Product - 3-slot free tier limit", True, "Correctly enforces 3-slot limit with 403")
            return True
        else:
            self.log_test("Product - 3-slot free tier limit", False, f"Expected 403, got {response.status_code}")
            return False
    
    def test_products_list(self):
        """Test list products"""
        response = self.make_request("GET", "/products")
        
        if not response:
            self.log_test("Product - List products", False, "Request failed")
            return False
            
        if response.status_code == 200:
            products = response.json()
            if len(products) >= 3:  # We created 3 products
                self.log_test("Product - List products", True, f"Retrieved {len(products)} products")
                return True
            else:
                self.log_test("Product - List products", False, f"Expected at least 3 products, got {len(products)}")
                return False
        else:
            self.log_test("Product - List products", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_products_get_single(self):
        """Test get single product"""
        if not self.products:
            self.log_test("Product - Get single product", False, "No products available")
            return False
            
        product_id = self.products[0]["id"]
        response = self.make_request("GET", f"/products/{product_id}")
        
        if not response:
            self.log_test("Product - Get single product", False, "Request failed")
            return False
            
        if response.status_code == 200:
            product = response.json()
            if product["id"] == product_id:
                self.log_test("Product - Get single product", True, "Product retrieved successfully")
                return True
            else:
                self.log_test("Product - Get single product", False, "Wrong product returned")
                return False
        else:
            self.log_test("Product - Get single product", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_products_update_reminder(self):
        """Test update reminder only"""
        if not self.products:
            self.log_test("Product - Update reminder only", False, "No products available")
            return False
            
        product_id = self.products[0]["id"]
        data = {"reminder_offset_hours": 48}
        
        response = self.make_request("PATCH", f"/products/{product_id}/reminder", data)
        
        if not response:
            self.log_test("Product - Update reminder only", False, "Request failed")
            return False
            
        if response.status_code == 200:
            product = response.json()
            if product["reminder_offset_hours"] == 48:
                self.log_test("Product - Update reminder only", True, "Reminder updated successfully")
                return True
            else:
                self.log_test("Product - Update reminder only", False, "Reminder not updated correctly")
                return False
        else:
            self.log_test("Product - Update reminder only", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_products_delete_before_expiry(self):
        """Test delete active (non-expired) product should return 403"""
        if not self.products:
            self.log_test("Product - Delete before expiry", False, "No products available")
            return False
            
        product_id = self.products[0]["id"]
        response = self.make_request("DELETE", f"/products/{product_id}")
        
        if not response:
            self.log_test("Product - Delete before expiry", False, "Request failed")
            return False
            
        if response.status_code == 403:
            self.log_test("Product - Delete before expiry", True, "Correctly prevents deletion of active product")
            return True
        else:
            self.log_test("Product - Delete before expiry", False, f"Expected 403, got {response.status_code}")
            return False
    
    def test_dashboard(self):
        """Test dashboard endpoint"""
        response = self.make_request("GET", "/dashboard")
        
        if not response:
            self.log_test("Dashboard endpoint", False, "Request failed")
            return False
            
        if response.status_code == 200:
            dashboard = response.json()
            required_fields = ["stats", "products", "expiring_soon", "fresh", "expired"]
            if all(field in dashboard for field in required_fields):
                stats = dashboard["stats"]
                required_stats = ["total_active", "expiring_soon", "expired", "slots_used", "slots_available", "max_slots"]
                if all(stat in stats for stat in required_stats):
                    self.log_test("Dashboard endpoint", True, f"Dashboard data complete. Active: {stats['total_active']}, Slots: {stats['slots_used']}/{stats['max_slots']}")
                    return True
                else:
                    self.log_test("Dashboard endpoint", False, f"Missing stats fields: {required_stats}")
                    return False
            else:
                self.log_test("Dashboard endpoint", False, f"Missing dashboard fields: {required_fields}")
                return False
        else:
            self.log_test("Dashboard endpoint", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_alerts(self):
        """Test alerts endpoint"""
        response = self.make_request("GET", "/alerts")
        
        if not response:
            self.log_test("Alerts endpoint", False, "Request failed")
            return False
            
        if response.status_code == 200:
            alerts_data = response.json()
            if "alerts" in alerts_data and "count" in alerts_data:
                self.log_test("Alerts endpoint", True, f"Alerts retrieved: {alerts_data['count']} alerts")
                return True
            else:
                self.log_test("Alerts endpoint", False, "Missing alerts or count in response")
                return False
        else:
            self.log_test("Alerts endpoint", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_niches_delete_custom(self):
        """Test delete custom niche (only empty custom niches can be deleted)"""
        # First create an empty custom niche
        data = {"niche_name": "Empty Custom Niche"}
        response = self.make_request("POST", "/niches", data)
        
        if not response or response.status_code not in [200, 201]:
            self.log_test("Niche - Delete custom niche", False, "Failed to create test niche")
            return False
            
        niche = response.json()
        niche_id = niche["id"]
        
        # Now try to delete it
        response = self.make_request("DELETE", f"/niches/{niche_id}")
        
        if not response:
            self.log_test("Niche - Delete custom niche", False, "Request failed")
            return False
            
        if response.status_code == 200:
            self.log_test("Niche - Delete custom niche", True, "Empty custom niche deleted successfully")
            return True
        else:
            self.log_test("Niche - Delete custom niche", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_niches_delete_default(self):
        """Test delete default niche should return 400"""
        # Find a default niche
        default_niche = None
        for niche in self.niches:
            if niche["niche_type"] == "default":
                default_niche = niche
                break
        
        if not default_niche:
            self.log_test("Niche - Delete default niche protection", False, "No default niche found")
            return False
            
        response = self.make_request("DELETE", f"/niches/{default_niche['id']}")
        
        if not response:
            self.log_test("Niche - Delete default niche protection", False, "Request failed")
            return False
            
        if response.status_code == 400:
            self.log_test("Niche - Delete default niche protection", True, "Correctly prevents deletion of default niche")
            return True
        else:
            self.log_test("Niche - Delete default niche protection", False, f"Expected 400, got {response.status_code}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Expirly Backend API Tests")
        print("=" * 50)
        
        # Auth tests
        if not self.test_auth_register():
            return False
        self.test_auth_duplicate_register()
        if not self.test_auth_me():
            return False
        
        # Niche tests
        if not self.test_niches_list():
            return False
        self.test_niches_create_custom()
        self.test_niches_duplicate_name()
        self.test_niches_delete_custom()
        self.test_niches_delete_default()
        
        # Product tests
        self.test_products_create()
        self.test_products_3_slot_limit()
        self.test_products_list()
        self.test_products_get_single()
        self.test_products_update_reminder()
        self.test_products_delete_before_expiry()
        
        # Dashboard and alerts
        self.test_dashboard()
        self.test_alerts()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = ExpirlyAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)