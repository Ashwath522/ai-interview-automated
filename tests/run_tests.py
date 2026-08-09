"""
Test runner for fairness, load, and latency tests.
"""
import subprocess
import sys
import os

def run_test_suite(test_path, suite_name):
    """Run a test suite and return results."""
    print(f"\n{'='*60}")
    print(f"Running {suite_name}")
    print(f"{'='*60}")

    try:
        # Change to the project root directory
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        os.chdir(project_root)

        # Run the test
        result = subprocess.run(
            [sys.executable, test_path],
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )

        print(result.stdout)
        if result.stderr:
            print("STDERR:")
            print(result.stderr)

        if result.returncode == 0:
            print(f"��✅ {suite_name} PASSED")
            return True
        else:
            print(f"��❌ {suite_name} FAILED (exit code {result.returncode})")
            return False

    except subprocess.TimeoutExpired:
        print(f"��❌ {suite_name} TIMEOUT (exceeded 60 seconds)")
        return False
    except Exception as e:
        print(f"��❌ {suite_name} ERROR: {e}")
        return False

def main():
    """Run all test suites."""
    print("Running Fairness, Load, and Latency Test Suites")
    print("=" * 60)

    # Define test suites
    test_suites = [
        ("tests/latency/test_risk_engine_benchmark.py", "Latency Benchmark Tests"),
        ("tests/load/test_concurrent_load.py", "Load and Stability Tests"),
        # Note: Fairness tests are included in the latency test file for now
    ]

    results = []
    for test_path, suite_name in test_suites:
        if os.path.exists(test_path):
            passed = run_test_suite(test_path, suite_name)
            results.append((suite_name, passed))
        else:
            print(f"��❌ Test file not found: {test_path}")
            results.append((suite_name, False))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    all_passed = True
    for suite_name, passed in results:
        status = "PASSED" if passed else "FAILED"
        print(f"{suite_name:<40} {status}")
        if not passed:
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("���🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("���💥 SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())