"""
TEST DOUBLE/MOCK: Python stub for risk scorer implementation.
This is a test double that provides the interface expected by the test files.
NOT FOR PRODUCTION USE - This is only for testing purposes.
In production, the actual TypeScript implementation in apps/web/lib/ should be used.
"""

from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class RiskScore:
    overall: float
    level: str  # 'low', 'medium', or 'high'


@dataclass
class RiskFactors:
    behavioral: float
    engagement: float
    concern_signals: float
    consistency: float


def calculateRiskScore(behavioralScore: float, anomalyCount: float, signalDeviation: float) -> RiskScore:
    """
    Calculate risk score based on behavioral score, anomaly count, and signal deviation.
    This is a simplified implementation that matches the expected behavior for testing.

    Based on the 40/30/20/10 weighting mentioned in the fairness test:
    - Behavioral: 40% weight
    - Engagement: 30% weight (derived from behavioralScore)
    - Concerns: 20% weight (derived from anomalyCount and signalDeviation)
    - Consistency: 10% weight (placeholder)
    """
    # Ensure inputs are in valid range
    behavioralScore = max(0, min(100, behavioralScore))
    anomalyCount = max(0, min(100, anomalyCount))
    signalDeviation = max(-100, min(100, signalDeviation))  # Can be negative for good lighting

    # Behavioral component (40% weight)
    behavioral_component = behavioralScore * 0.4

    # Engagement component (30% weight) - simplified as behavioralScore for now
    engagement_component = behavioralScore * 0.3

    # Concern signals component (20% weight)
    # Combine anomaly count and signal deviation into a concern score
    # anomalyCount: 0-100 where higher is more anomalies
    # signalDeviation: -100 to 100 where negative is better (good lighting), positive is worse (poor lighting)
    # We'll convert signalDeviation to a 0-100 scale where 0 is ideal
    normalized_deviation = abs(signalDeviation)  # Treat positive and negative deviation equally for concern
    concern_raw = (anomalyCount * 0.7) + (normalized_deviation * 0.3)  # Weight anomaly count more
    concern_raw = max(0, min(100, concern_raw))  # Clamp to 0-100
    concern_component = concern_raw * 0.2

    # Consistency component (10% weight) - placeholder
    consistency_component = 50 * 0.1  # Neutral consistency

    # Calculate total score
    total_score = behavioral_component + engagement_component + concern_component + consistency_component

    # Ensure score is in 0-100 range
    total_score = max(0, min(100, total_score))

    # Determine risk level
    if total_score < 35:
        level = 'low'
    elif total_score < 65:
        level = 'medium'
    else:
        level = 'high'

    return RiskScore(overall=total_score, level=level)


def generateDecisionContext(behavioral_score: float, risk_level: str, interview_duration_seconds: int) -> dict:
    """
    Generate decision context for interview evaluation.
    Simplified implementation for testing purposes.
    """
    return {
        'behavioral_score': behavioral_score,
        'risk_level': risk_level,
        'interview_duration_seconds': interview_duration_seconds,
        'recommendation': 'proceed' if risk_level == 'low' else 'review' if risk_level == 'medium' else 'escalate',
        'confidence': 0.85  # Placeholder confidence score
    }


# Additional helper functions that might be needed
def get_risk_level_description(level: str) -> str:
    """Get human-readable description of risk level."""
    descriptions = {
        'low': 'Low risk - standard proceeding recommended',
        'medium': 'Medium risk - additional review suggested',
        'high': 'High risk - immediate attention required'
    }
    return descriptions.get(level, 'Unknown risk level')