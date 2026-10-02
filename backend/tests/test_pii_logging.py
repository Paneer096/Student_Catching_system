"""
Makerove — Test PII Scrubbing in Logging (R9 Quality Gate)
"""
from app.logging_config import _scrub_pii, _PII_PATTERNS


def test_pii_scrubbing_patterns():
    # Email
    msg1 = "User requested login for student@college.edu today"
    scrubbed1 = _scrub_pii(msg1)
    assert "student@college.edu" not in scrubbed1
    assert "[PII_REDACTED]" in scrubbed1

    # Phone number
    msg2 = "Notification sent to mobile +919876543210 regarding class"
    scrubbed2 = _scrub_pii(msg2)
    assert "+919876543210" not in scrubbed2
    assert "[PII_REDACTED]" in scrubbed2

    # Indian roll number
    msg3 = "Fetched record for roll number CS23045 in Section CS-3B"
    scrubbed3 = _scrub_pii(msg3)
    assert "CS23045" not in scrubbed3
    assert "[PII_REDACTED]" in scrubbed3
