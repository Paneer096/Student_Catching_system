"""
Makerove — Password Hashing (argon2id)

Uses argon2-cffi for password hashing per §3.3 security baseline.
"""
from __future__ import annotations

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,  # argon2id
)


def hash_password(password: str) -> str:
    """Hash a password using argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    """
    Verify a password against an argon2id hash.
    Returns False on mismatch — never raises to the caller.
    """
    try:
        return _hasher.verify(hash_, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hash_: str) -> bool:
    """Check if the hash needs to be re-hashed with updated parameters."""
    return _hasher.check_needs_rehash(hash_)
