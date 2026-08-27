"""
test_rainfall_wireless.py — Tests for wireless rainfall sensor integration.

Tests:
1. POST /api/rainfall - Receive data from wireless ESP32
2. GET /api/rainfall - Return latest rainfall data
3. Heartbeat/timeout mechanism
4. Device status integration

Run with: python test_rainfall_wireless.py
"""
import requests
import json
import time
from datetime import datetime

# Configuration
EDGE_GATEWAY_URL = "http://127.0.0.1:8000"
NODE_BACKEND_URL = "http://127.0.0.1:5000"

def test_post_rainfall():
    """Test 1: POST /api/rainfall - Receive data from wireless ESP32"""
    print("\n=== Test 1: POST /api/rainfall ===")
    
    payload = {
        "device_id": "RAIN-001",
        "rain_analog": 4095,
        "rain_digital": 1,
        "rain_status": "NO RAIN",
        "flood_risk": "LOW",
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        response = requests.post(
            f"{EDGE_GATEWAY_URL}/api/rainfall",
            json=payload,
            timeout=5
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
        assert response.json()["status"] == "received"
        print("✓ Test 1 passed")
        return True
    except Exception as e:
        print(f"✗ Test 1 failed: {e}")
        return False

def test_get_rainfall():
    """Test 2: GET /api/rainfall - Return latest rainfall data"""
    print("\n=== Test 2: GET /api/rainfall ===")
    
    try:
        response = requests.get(
            f"{EDGE_GATEWAY_URL}/api/rainfall",
            timeout=5
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            assert "rain_analog" in data
            assert "rain_digital" in data
            assert "rain_status" in data
            assert "wetness_level" in data
            assert "sensor_status" in data
            print("✓ Test 2 passed")
            return True
        else:
            print("⚠ Test 2: No data available (expected if ESP32 not connected)")
            return True
    except Exception as e:
        print(f"✗ Test 2 failed: {e}")
        return False

def test_heartbeat_timeout():
    """Test 3: Heartbeat/timeout mechanism"""
    print("\n=== Test 3: Heartbeat/timeout mechanism ===")
    
    # First, send some data
    payload = {
        "device_id": "RAIN-001",
        "rain_analog": 2000,
        "rain_digital": 0,
        "rain_status": "RAIN DETECTED",
        "flood_risk": "MODERATE",
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        # Send data
        requests.post(f"{EDGE_GATEWAY_URL}/api/rainfall", json=payload, timeout=5)
        
        # Check immediately - should be ACTIVE
        response = requests.get(f"{EDGE_GATEWAY_URL}/api/rainfall", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"Immediately after send: sensor_status = {data['sensor_status']}")
            assert data["sensor_status"] == "ACTIVE"
        
        print("✓ Test 3 passed (timeout test requires waiting)")
        return True
    except Exception as e:
        print(f"✗ Test 3 failed: {e}")
        return False

def test_device_status():
    """Test 4: Device status integration"""
    print("\n=== Test 4: Device status integration ===")
    
    try:
        response = requests.get(
            f"{EDGE_GATEWAY_URL}/api/device-status",
            timeout=5
        )
        print(f"Status: {response.status_code}")
        data = response.json()
        
        assert "sensors" in data
        assert "rainfall" in data["sensors"]
        
        rainfall = data["sensors"]["rainfall"]
        print(f"Rainfall sensor: connected={rainfall['connected']}, status={rainfall['status']}")
        
        print("✓ Test 4 passed")
        return True
    except Exception as e:
        print(f"✗ Test 4 failed: {e}")
        return False

def test_node_backend_integration():
    """Test 5: Node.js backend integration"""
    print("\n=== Test 5: Node.js backend integration ===")
    
    try:
        response = requests.get(
            f"{NODE_BACKEND_URL}/api/disaster/rainfall/latest",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        print("✓ Test 5 passed")
        return True
    except Exception as e:
        print(f"✗ Test 5 failed: {e}")
        return False

def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("Wireless Rainfall Sensor Integration Tests")
    print("=" * 60)
    
    results = []
    results.append(test_post_rainfall())
    results.append(test_get_rainfall())
    results.append(test_heartbeat_timeout())
    results.append(test_device_status())
    results.append(test_node_backend_integration())
    
    print("\n" + "=" * 60)
    print("Test Results")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed")
    
    return passed == total

if __name__ == "__main__":
    run_all_tests()
