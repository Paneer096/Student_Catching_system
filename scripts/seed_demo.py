"""
Makerove — Demo Seed Script

Creates demo users with seeded passwords from .env.
All users start with must_change_password=True.
Run: python scripts/seed_demo.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.config.settings import get_settings
from app.db import init_db, get_db_context
from app.models.orm import User, Teacher, Student, Section, Subject
from app.models.enums import UserRole
from app.security.passwords import hash_password


settings = get_settings()


async def seed():
    """Seed the database with demo data."""
    await init_db()

    async with get_db_context() as db:
        # ── Create Sections ──────────────────────────────────────────────
        sections = [
            Section(id="sec-cs3a", code="CS-3A", semester=5, strength=60, department="Computer Science"),
            Section(id="sec-cs3b", code="CS-3B", semester=5, strength=60, department="Computer Science"),
            Section(id="sec-cs3c", code="CS-3C", semester=5, strength=60, department="Computer Science"),
        ]
        for s in sections:
            db.add(s)

        # ── Create Subjects ──────────────────────────────────────────────
        subjects = [
            Subject(id="sub-cs301", code="CS301", name="Data Structures", credits=4, is_lab=False, criticality=4),
            Subject(id="sub-cs302", code="CS302", name="Operating Systems", credits=4, is_lab=False, criticality=4),
            Subject(id="sub-cs303", code="CS303", name="Database Systems", credits=3, is_lab=False, criticality=3),
            Subject(id="sub-cs304", code="CS304", name="Computer Networks", credits=3, is_lab=False, criticality=3),
            Subject(id="sub-phy101", code="PHY101", name="Engineering Physics", credits=4, is_lab=False, criticality=4),
            Subject(id="sub-mat201", code="MAT201", name="Discrete Mathematics", credits=3, is_lab=False, criticality=3),
            Subject(id="sub-cs305l", code="CS305L", name="DS Lab", credits=2, is_lab=True, criticality=2),
        ]
        for s in subjects:
            db.add(s)

        # ── Create Teachers ──────────────────────────────────────────────
        teachers = [
            Teacher(id="tch-001", name="Prof. Anand Kumar", department="Computer Science"),
            Teacher(id="tch-002", name="Prof. Meera Sharma", department="Computer Science"),
            Teacher(id="tch-003", name="Prof. Rajesh Singh", department="Computer Science"),
            Teacher(id="tch-004", name="Dr. Sanjay Patel", department="Computer Science"),
            Teacher(id="tch-005", name="Dr. Priya Menon", department="Computer Science"),
        ]
        for t in teachers:
            db.add(t)

        # Assign class teachers
        sections[0].class_teacher_id = "tch-001"
        sections[1].class_teacher_id = "tch-002"
        sections[2].class_teacher_id = "tch-003"

        await db.flush()

        # ── Create Users ─────────────────────────────────────────────────
        users = [
            # Class Teachers
            User(
                id="usr-ct-csb",
                username="meera.sharma",
                password_hash=hash_password(settings.DEMO_TEACHER_PASSWORD),
                role=UserRole.CLASS_TEACHER,
                teacher_id="tch-002",
                must_change_password=True,
            ),
            User(
                id="usr-ct-csa",
                username="anand.kumar",
                password_hash=hash_password(settings.DEMO_TEACHER_PASSWORD),
                role=UserRole.CLASS_TEACHER,
                teacher_id="tch-001",
                must_change_password=True,
            ),
            User(
                id="usr-ct-csc",
                username="rajesh.singh",
                password_hash=hash_password(settings.DEMO_TEACHER_PASSWORD),
                role=UserRole.CLASS_TEACHER,
                teacher_id="tch-003",
                must_change_password=True,
            ),
            # Subject Teacher
            User(
                id="usr-st-phy",
                username="sanjay.patel",
                password_hash=hash_password(settings.DEMO_TEACHER_PASSWORD),
                role=UserRole.SUBJECT_TEACHER,
                teacher_id="tch-004",
                must_change_password=True,
            ),
            # HOD
            User(
                id="usr-hod-cs",
                username="cs.hod",
                password_hash=hash_password(settings.DEMO_HOD_PASSWORD),
                role=UserRole.HOD,
                teacher_id="tch-005",
                must_change_password=True,
            ),
            # Counselor
            User(
                id="usr-counselor",
                username="counselor",
                password_hash=hash_password(settings.DEMO_COUNSELOR_PASSWORD),
                role=UserRole.COUNSELOR,
                must_change_password=True,
            ),
            # Admin
            User(
                id="usr-admin",
                username="admin",
                password_hash=hash_password(settings.DEMO_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                must_change_password=True,
            ),
        ]
        for u in users:
            db.add(u)

        await db.flush()
        print(f"[OK] Seeded {len(sections)} sections, {len(subjects)} subjects, "
              f"{len(teachers)} teachers, {len(users)} users")

        # Print login credentials
        print("\n--- Demo Login Credentials -------------------------")
        print(f"  Class Teacher (CS-3B):  meera.sharma / {settings.DEMO_TEACHER_PASSWORD}")
        print(f"  Class Teacher (CS-3A):  anand.kumar  / {settings.DEMO_TEACHER_PASSWORD}")
        print(f"  Class Teacher (CS-3C):  rajesh.singh / {settings.DEMO_TEACHER_PASSWORD}")
        print(f"  Subject Teacher:        sanjay.patel / {settings.DEMO_TEACHER_PASSWORD}")
        print(f"  HOD (CS):               cs.hod       / {settings.DEMO_HOD_PASSWORD}")
        print(f"  Counselor:              counselor    / {settings.DEMO_COUNSELOR_PASSWORD}")
        print(f"  Admin:                  admin        / {settings.DEMO_ADMIN_PASSWORD}")
        print("----------------------------------------------------")
        print("\n[OK] All users require password change on first login.")


if __name__ == "__main__":
    asyncio.run(seed())
