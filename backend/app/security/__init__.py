# Makerove — Security Package
from .passwords import hash_password, verify_password, needs_rehash
from .sessions import create_session, get_session, destroy_session
from .rbac import AuthContext, get_current_user, require_roles, require_csrf
from .audit_log import append_audit_entry, verify_audit_chain
from .consent import get_notice_info, accept_notice, withdraw_consent, has_accepted_current_notice

__all__ = [
    "hash_password", "verify_password", "needs_rehash",
    "create_session", "get_session", "destroy_session",
    "AuthContext", "get_current_user", "require_roles", "require_csrf",
    "append_audit_entry", "verify_audit_chain",
    "get_notice_info", "accept_notice", "withdraw_consent", "has_accepted_current_notice",
]
