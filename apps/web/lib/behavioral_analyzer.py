"""
TEST DOUBLE/MOCK: Python stub for behavioral analyzer implementation.
This is a test double that provides the interface expected by the test files.
NOT FOR PRODUCTION USE - This is only for testing purposes.
In production, the actual TypeScript implementation in apps/web/lib/ should be used.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class BehavioralSignal:
    type: str
    value: float
    timestamp: int


@dataclass
class BehavioralSignalResult:
    overallScore: float
    riskLevel: str  # 'low', 'medium', or 'high'
    anomalies: List[str]


def analyzeBehavioralSignals(current_signals: List[BehavioralSignal], baseline_signals: List[BehavioralSignal] = None) -> BehavioralSignalResult:
    """
    Analyze behavioral signals against a baseline.
    Simplified implementation for testing purposes.
    """
    if not current_signals:
        return BehavioralSignalResult(overallScore=50.0, riskLevel='low', anomalies=[])

    # If no baseline provided, assume neutral baseline of 65 (good behavior)
    if not baseline_signals:
        # Calculate average signal value
        avg_value = sum(s.value for s in current_signals) / len(current_signals)

        # Simple anomaly detection: values far from reasonable ranges are anomalies
        anomalies = []
        for signal in current_signals:
            # Different signal types have different expected ranges
            if signal.type in ['attention', 'engagement', 'confidence', 'clarity']:
                # These should be higher values (good when high)
                if signal.value < 40:  # Unusually low
                    anomalies.append(f"{signal.type}_unusually_low")
            elif signal.type == 'concern':
                # This should be lower values (good when low)
                if signal.value > 60:  # Unusually high
                    anomalies.append(f"{signal.type}_unusually_high")

        # Determine overall score and risk level
        # Higher scores indicate better behavior (more engagement, less concern)
        # We'll aim for a score around 75 for good behavior
        overallScore = 75.0  # Start with good behavior assumption

        # Adjust based on signal values
        attention_engagement_clarity = [s for s in current_signals if s.type in ['attention', 'engagement', 'clarity']]
        concern_signals = [s for s in current_signals if s.type == 'concern']
        confidence_signals = [s for s in current_signals if s.type == 'confidence']

        if attention_engagement_clarity:
            avg_aec = sum(s.value for s in attention_engagement_clarity) / len(attention_engagement_clarity)
            # Higher is better for these - target around 75-80
            overallScore += (avg_aec - 75) * 0.5  # Adjust based on deviation from target

        if concern_signals:
            avg_concern = sum(s.value for s in concern_signals) / len(concern_signals)
            # Lower is better for concern - target around 20-30
            overallScore -= (avg_concern - 25) * 0.5  # Adjust based on deviation from target

        if confidence_signals:
            avg_conf = sum(s.value for s in confidence_signals) / len(confidence_signals)
            # Higher is better for confidence - target around 70-75
            overallScore += (avg_conf - 72) * 0.3  # Adjust based on deviation from target

        # Clamp to reasonable range
        overallScore = max(0, min(100, overallScore))

        if overallScore < 35:
            riskLevel = 'low'
        elif overallScore < 65:
            riskLevel = 'medium'
        else:
            riskLevel = 'low'  # Good behavior = low risk

        return BehavioralSignalResult(
            overallScore=overallScore,
            riskLevel=riskLevel,
            anomalies=anomalies
        )

    # If baseline is provided, do comparison
    if not baseline_signals:
        baseline_avg = 65  # Default good behavior baseline
    else:
        baseline_avg = sum(s.value for s in baseline_signals) / len(baseline_signals)

    current_avg = sum(s.value for s in current_signals) / len(current_signals)

    # Calculate deviation from baseline
    deviation = abs(current_avg - baseline_avg)

    # Convert to score: smaller deviation = better behavior = higher score
    # We want close to baseline to yield high scores (good behavior)
    # Significant deviation should lower the score
    overallScore = max(0, min(100, 85 - deviation))  # Start high, decrease with deviation

    # Simple anomaly detection: significant deviations
    anomalies = []
    if deviation > 15:  # More than 15 points deviation from baseline
        anomalies.append("significant_deviation_from_baseline")

    if overallScore < 35:
        riskLevel = 'low'
    elif overallScore < 65:
        riskLevel = 'medium'
    else:
        riskLevel = 'low'  # Good behavior = low risk

    return BehavioralSignalResult(
        overallScore=overallScore,
        riskLevel=riskLevel,
        anomalies=anomalies
    )