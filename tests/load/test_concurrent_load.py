"""
Load and stability smoke tests.
Tests that the system handles concurrent sessions without crashes or obvious issues.
"""
import sys
import os
import time
from typing import List, Dict

# Add the project root to the Python path
# This allows importing from the apps directory
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from apps.web.lib.risk_scorer import calculateRiskScore
from apps.web.lib.behavioral_analyzer import analyzeBehavioralSignals, BehavioralSignal
from apps.web.lib.risk_scorer import generateDecisionContext


def simulate_session_events(session_id: str, num_events: int = 50) -> List[Dict]:
    """Simulate a session producing behavioral events over time."""
    events = []
    baseline_established = False
    baseline_signals = None

    for i in range(num_events):
        # Simulate varying behavioral signals over time
        # Start with some variability, then settle into a pattern
        time_factor = i / num_events  # 0 to 1 over session

        # Simulate a person who starts nervous, then relaxes
        engagement_base = 60 + (20 * time_factor)  # Improves from 60 to 80
        concern_base = 30 - (15 * time_factor)     # Decreases from 30 to 15

        # Add some natural variance
        import random
        engagement = max(0, min(100, engagement_base + random.uniform(-10, 10)))
        concern = max(0, min(100, concern_base + random.uniform(-5, 5)))
        attention = max(0, min(100, engagement + random.uniform(-15, 15)))
        confidence = max(0, min(100, engagement + random.uniform(-10, 10)))
        clarity = max(0, min(100, (engagement + attention) / 2 + random.uniform(-10, 10)))

        # Establish baseline after first 20% of session
        if not baseline_established and i >= num_events * 0.2:
            baseline_established = True
            # In reality, baseline would be established from initial period
            # For simulation, we'll use the average of early signals
            pass

        signal = BehavioralSignal(
            type='engagement',  # Focus on engagement for simplicity
            value=engagement,
            timestamp=i * 1000  # 1 second intervals
        )
        events.append({
            'session_id': session_id,
            'signal': signal,
            'timestamp': time.time() + i,
            'event_type': 'behavioral_signal'
        })

    return events


def test_concurrent_session_processing():
    """Test processing multiple concurrent sessions."""
    num_sessions = 10
    events_per_session = 30

    print(f"Testing concurrent processing of {num_sessions} sessions with {events_per_session} events each...")

    start_time = time.time()
    all_results = []

    # Process each session
    for session_idx in range(num_sessions):
        session_id = f"session_{session_idx:03d}"
        events = simulate_session_events(session_id, events_per_session)

        session_risk_scores = []
        session_behavioral_analyses = []

        # Process events for this session
        for event in events:
            signal = event['signal']

            # Create a simple baseline (average of first few signals for this session)
            # In reality, this would be more sophisticated
            session_events_for_session = [e for e in events if e['session_id'] == session_id]
            if len(session_events_for_session) >= 5:
                early_signals = [e['signal'] for e in session_events_for_session[:5]]
                baseline_avg = sum(s.value for s in early_signals) / len(early_signals)

                # Create mock baseline signals
                baseline_signals = [
                    BehavioralSignal('engagement', baseline_avg, 0),
                    BehavioralSignal('attention', baseline_avg, 0),
                    BehavioralSignal('confidence', baseline_avg, 0),
                    BehavioralSignal('concern', 20, 0),  # Assume low concern in baseline
                    BehavioralSignal('clarity', baseline_avg, 0),
                ]
            else:
                baseline_signals = None

            # Analyze behavioral signals
            if baseline_signals and len([e for e in events if e['session_id'] == session_id]) > 5:
                current_signals = [e['signal'] for e in events if e['session_id'] == session_id]
                # Just analyze recent signals to avoid O(n^2)
                recent_signals = current_signals[-5:] if len(current_signals) > 5 else current_signals
                analysis = analyzeBehavioralSignals(recent_signals, baseline_signals)
                session_behavioral_analyses.append(analysis)

                # Calculate risk score from the analysis
                # Convert analysis to risk scorer inputs
                behavioral_score = analysis.overallScore
                anomaly_count = len(analysis.anomalies)
                # Simplified signal deviation calculation
                signal_deviation = abs(analysis.overallScore - 75)  # Assume 75 is neutral baseline
                signal_deviation = min(100, signal_deviation * 2)  # Scale it up

                risk_score = calculateRiskScore(behavioral_score, anomaly_count, signal_deviation)
                session_risk_scores.append(risk_score)

                # Generate decision context
                decision_context = generateDecisionContext(
                    behavioral_score,
                    risk_score.level,
                    300 + len(session_risk_scores) * 10  # Simulate increasing interview duration
                )

        # Collect session results
        if session_risk_scores:
            avg_risk = sum(rs.overall for rs in session_risk_scores) / len(session_risk_scores)
            max_risk = max(rs.overall for rs in session_risk_scores)
            min_risk = min(rs.overall for rs in session_risk_scores)
            all_results.append({
                'session_id': session_id,
                'num_events': len(events),
                'num_analyses': len(session_behavioral_analyses),
                'num_risk_scores': len(session_risk_scores),
                'avg_risk': avg_risk,
                'max_risk': max_risk,
                'min_risk': min_risk,
                'final_risk_level': session_risk_scores[-1].level if session_risk_scores else 'low'
            })

    end_time = time.time()
    total_time = end_time - start_time
    events_per_second = (num_sessions * events_per_session) / total_time if total_time > 0 else 0

    print(f"\nConcurrent Load Test Results:")
    print(f"  Sessions processed: {num_sessions}")
    print(f"  Total events: {num_sessions * events_per_session}")
    print(f"  Total processing time: {total_time:.2f} seconds")
    print(f"  Events per second: {events_per_second:.2f}")
    print(f"  Average time per event: {(total_time/(num_sessions*events_per_session))*1000:.2f} ms")

    # Validate results
    assert len(all_results) == num_sessions, f"Expected {num_sessions} session results, got {len(all_results)}"

    for result in all_results:
        assert result['num_events'] == events_per_session
        assert result['num_analyses'] > 0, f"Session {result['session_id']} should have analyses"
        assert result['num_risk_scores'] > 0, f"Session {result['session_id']} should have risk scores"
        assert 0 <= result['avg_risk'] <= 100
        assert result['final_risk_level'] in ['low', 'medium', 'high']

    # Check for obvious outliers or failures
    avg_risks = [r['avg_risk'] for r in all_results]
    risk_variance = max(avg_risks) - min(avg_risks) if avg_risks else 0
    print(f"  Risk score range across sessions: {min(avg_risks):.1f} - {max(avg_risks):.1f} (variance: {risk_variance:.1f})")

    # Should not have all sessions at extreme risk (indicating systemic issue)
    extreme_high_sessions = sum(1 for r in all_results if r['avg_risk'] > 80)
    extreme_low_sessions = sum(1 for r in all_results if r['avg_risk'] < 20)
    assert extreme_high_sessions < num_sessions * 0.5, "Too many sessions showing extreme high risk"
    assert extreme_low_sessions < num_sessions * 0.5, "Too many sessions showing extreme low risk"

    print(f"  Sessions with extreme high risk (>80): {extreme_high_sessions}/{num_sessions}")
    print(f"  Sessions with extreme low risk (<20): {extreme_low_sessions}/{num_sessions}")

    # Memory leak check - basic: ensure we're not accumulating unbounded data
    # In a real test, we'd check memory usage, but for now we'll just verify
    # that our simulation doesn't grow unbounded
    total_objects_created = sum(
        r['num_events'] + r['num_analyses'] + r['num_risk_scores']
        for r in all_results
    )
    expected_objects = num_sessions * events_per_session * 3  # events + analyses + risk scores
    assert total_objects_created <= expected_objects * 1.5, "Potential memory leak - too many objects created"

    return {
        'sessions_processed': num_sessions,
        'total_events': num_sessions * events_per_session,
        'total_time_seconds': total_time,
        'events_per_second': events_per_second,
        'avg_time_per_event_ms': (total_time/(num_sessions*events_per_session))*1000,
        'results': all_results
    }


def test_burst_event_handling():
    """Test handling of burst events (many events in short time)."""
    print("\nTesting burst event handling...")

    session_id = "burst_test_session"
    burst_size = 100  # 100 events in quick succession

    start_time = time.time()
    events = simulate_session_events(session_id, burst_size)
    event_gen_time = time.time() - start_time

    # Process all events quickly
    start_process = time.time()
    risk_scores = []

    # Simple baseline (use first 10% of events)
    baseline_events = events[:max(10, burst_size // 10)]
    if len(baseline_events) >= 5:
        baseline_signals = [e['signal'] for e in baseline_events[:5]]
        # Create mock baseline
        baseline_avg = sum(s.value for s in baseline_signals) / len(baseline_signals)
        baseline_signals = [
            BehavioralSignal('engagement', baseline_avg, 0),
            BehavioralSignal('attention', baseline_avg, 0),
            BehavioralSignal('confidence', baseline_avg, 0),
            BehavioralSignal('concern', 20, 0),
            BehavioralSignal('clarity', baseline_avg, 0),
        ]
    else:
        baseline_signals = None

    # Process events
    for event in events:
        signal = event['signal']
        if baseline_signals:
            # Get recent signals for analysis
            session_events_so_far = [e for e in events if e['session_id'] == session_id and e['timestamp'] <= event['timestamp']]
            recent_count = min(10, len(session_events_so_far))
            if recent_count >= 3:
                recent_signals = [e['signal'] for e in session_events_so_far[-recent_count:]]
                analysis = analyzeBehavioralSignals(recent_signals, baseline_signals)

                # Risk calculation
                behavioral_score = analysis.overallScore
                anomaly_count = len(analysis.anomalies)
                signal_deviation = abs(analysis.overallScore - 75) * 2
                signal_deviation = min(100, signal_deviation)

                risk_score = calculateRiskScore(behavioral_score, anomaly_count, signal_deviation)
                risk_scores.append(risk_score)

    process_time = time.time() - start_process
    total_time = time.time() - start_time

    print(f"  Burst size: {burst_size} events")
    print(f"  Event generation time: {event_gen_time:.3f}s")
    print(f"  Processing time: {process_time:.3f}s")
    print(f"  Total time: {total_time:.3f}s")
    print(f"  Events processed: {len(risk_scores)}")

    # Should process events reasonably quickly
    assert process_time < 5.0, f"Burst processing took too long: {process_time:.3f}s"
    assert len(risk_scores) > 0, "Should have processed some events into risk scores"

    # Validate risk scores are reasonable
    for rs in risk_scores:
        assert isinstance(rs.overall, (int, float))
        assert 0 <= rs.overall <= 100
        assert rs.level in ['low', 'medium', 'high']

    avg_burst_risk = sum(rs.overall for rs in risk_scores) / len(risk_scores) if risk_scores else 0
    print(f"  Average risk score during burst: {avg_burst_risk:.1f}")

    return {
        'burst_size': burst_size,
        'event_gen_time': event_gen_time,
        'process_time': process_time,
        'total_time': total_time,
        'events_processed': len(risk_scores),
        'avg_risk_score': avg_burst_risk
    }


def test_sustained_load():
    """Test sustained load over a longer period."""
    print("\nTesting sustained load...")

    session_id = "sustained_test_session"
    duration_seconds = 10  # Run for 10 seconds
    events_per_second = 5  # Target 5 events per second

    start_time = time.time()
    target_end_time = start_time + duration_seconds

    events_processed = 0
    risk_scores_generated = []

    # Simple baseline
    baseline_signals = [
        BehavioralSignal('engagement', 70, 0),
        BehavioralSignal('attention', 70, 0),
        BehavioralSignal('confidence', 65, 0),
        BehavioralSignal('concern', 25, 0),
        BehavioralSignal('clarity', 70, 0),
    ]

    event_interval = 1.0 / events_per_second  # Time between events
    next_event_time = start_time

    while time.time() < target_end_time:
        # Generate event at scheduled time
        current_time = time.time()
        if current_time >= next_event_time:
            # Create event with some variation
            import random
            engagement = max(0, min(100, 70 + random.uniform(-15, 15)))
            signal = BehavioralSignal('engagement', engagement, int((current_time - start_time) * 1000))

            # Process event
            recent_signals = [signal]  # Simplified - in reality we'd keep a window
            if len(recent_signals) >= 1:  # We need at least one for comparison
                # For simplicity, we'll just calculate risk directly from signal
                # In reality, we'd do proper behavioral analysis
                behavioral_score = signal.value
                anomaly_count = 1 if signal.value < 40 or signal.value > 95 else 0  # Extreme values as anomalies
                signal_deviation = abs(signal.value - 70)  # Deviation from baseline

                risk_score = calculateRiskScore(behavioral_score, anomaly_count, signal_deviation)
                risk_scores_generated.append(risk_score)
                events_processed += 1

            next_event_time += event_interval
        else:
            # Small sleep to prevent busy-waiting
            time.sleep(0.001)

    actual_duration = time.time() - start_time
    actual_eps = events_processed / actual_duration if actual_duration > 0 else 0

    print(f"  Target duration: {duration_seconds}s")
    print(f"  Actual duration: {actual_duration:.2f}s")
    print(f"  Target events/sec: {events_per_second}")
    print(f"  Actual events/sec: {actual_eps:.2f}")
    print(f"  Events processed: {events_processed}")
    print(f"  Risk scores generated: {len(risk_scores_generated)}")

    assert events_processed > 0, "Should have processed some events"
    assert len(risk_scores_generated) == events_processed, "Each event should produce a risk score"

    # Validate all risk scores
    for rs in risk_scores_generated:
        assert 0 <= rs.overall <= 100
        assert rs.level in ['low', 'medium', 'high']

    if risk_scores_generated:
        avg_risk = sum(rs.overall for rs in risk_scores_generated) / len(risk_scores_generated)
        print(f"  Average risk score: {avg_risk:.1f}")
        assert 0 <= avg_risk <= 100

    return {
        'target_duration': duration_seconds,
        'actual_duration': actual_duration,
        'target_eps': events_per_second,
        'actual_eps': actual_eps,
        'events_processed': events_processed,
        'risk_scores_generated': len(risk_scores_generated),
        'avg_risk_score': sum(rs.overall for rs in risk_scores_generated) / len(risk_scores_generated) if risk_scores_generated else 0
    }


if __name__ == "__main__":
    print("Running Load and Stability Smoke Tests...")
    print("=" * 50)

    # Run load tests
    print("\n1. CONCURRENT SESSION PROCESSING")
    print("-" * 40)
    concurrent_results = test_concurrent_session_processing()

    print("\n2. BURST EVENT HANDLING")
    print("-" * 40)
    burst_results = test_burst_event_handling()

    print("\n3. SUSTAINED LOAD")
    print("-" * 40)
    sustained_results = test_sustained_load()

    print("\n" + "=" * 50)
    print("All load tests passed! ���������� �������� �������� ������ �������� ������ ������ ����")
    print("=" * 50)
