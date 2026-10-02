"""
Makerove — Test Auth & RBAC Security Baseline (G11 Guardrail)
"""
import pytest
from app.security.passwords import hash_password, verify_password, needs_rehash
from app.models.enums import UserRole


def test_argon2id_password_hashing():
    raw = "SecureP@ssw0rd!2026"
    hashed = hash_password(raw)

    assert hashed.startswith("$argon2id$")
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert needs_rehash(hashed) is False


def test_rbac_roles_exist():
    expected_roles = {
        "CLASS_TEACHER",
        "SUBJECT_TEACHER",
        "HOD",
        "COUNSELOR",
        "ADMIN",
        "STUDENT",
    }
    actual_roles = {r.value for r in UserRole}
    assert expected_roles.issubset(actual_roles)
