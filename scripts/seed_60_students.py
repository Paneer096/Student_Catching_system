"""
Seed 60 Students with Rich Social Network & Co-Absence Data for Section CS-3B
Ensures authentic Louvain communities, bunk cliques, study groups, and club memberships.
"""
import asyncio
import sys
import uuid
import random
from datetime import date, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db import async_session_factory, init_db
from app.models.orm import (
    Section, Student, Teacher, Subject, Attendance, 
    Club, ClubMembership, Observation, Intervention, SurveyWave, SurveyResponse
)
from sqlalchemy import select, delete

# Deterministic seed for reproducible graph
random.seed(42)

NAMES_60 = [
    # Cluster 1: High-Risk Bunk Circle (Repeated mass absences)
    ("21CSB001", "Aarav Patel", "M"),
    ("21CSB002", "Kabir Mehra", "M"),
    ("21CSB003", "Rohan Verma", "M"),
    ("21CSB004", "Aditya Kapoor", "M"),
    ("21CSB005", "Yash Malhotra", "M"),
    ("21CSB006", "Aryan Saxena", "M"),
    ("21CSB007", "Varun Mehta", "M"),
    ("21CSB008", "Karan Singhal", "M"),
    ("21CSB009", "Dhruv Bhatnagar", "M"),
    ("21CSB010", "Samar Sen", "M"),

    # Cluster 2: Study Circle Alpha (High attendance, high CGPA, mutual study partners)
    ("21CSB011", "Priya Desai", "F"),
    ("21CSB012", "Ananya Roy", "F"),
    ("21CSB013", "Kavita Sen", "F"),
    ("21CSB014", "Rohit Sharma", "M"),
    ("21CSB015", "Sneha Kulkarni", "F"),
    ("21CSB016", "Tanvi Joshi", "F"),
    ("21CSB017", "Riya Mukherjee", "F"),
    ("21CSB018", "Nikhil Verma", "M"),
    ("21CSB019", "Divya Pillai", "F"),
    ("21CSB020", "Megha Nair", "F"),

    # Cluster 3: Robotics & AI Club (Engaged in labs, tech projects)
    ("21CSB021", "Amit Kumar", "M"),
    ("21CSB022", "Devendra Soni", "M"),
    ("21CSB023", "Ishaan Ghosh", "M"),
    ("21CSB024", "Pranav Hegde", "M"),
    ("21CSB025", "Siddharth Rao", "M"),
    ("21CSB026", "Gaurav Chawla", "M"),
    ("21CSB027", "Alok Pandey", "M"),
    ("21CSB028", "Naveen Reddy", "M"),
    ("21CSB029", "Manish Joshi", "M"),
    ("21CSB030", "Kunal Bansal", "M"),

    # Cluster 4: Cultural & Sports Society (Sports team absences on specific Fridays)
    ("21CSB031", "Simran Patel", "F"),
    ("21CSB032", "Tarun Mishra", "M"),
    ("21CSB033", "Pooja Hegde", "F"),
    ("21CSB034", "Rajeshwari Iyer", "F"),
    ("21CSB035", "Vikram Rathore", "M"),
    ("21CSB036", "Harshavardhan Das", "M"),
    ("21CSB037", "Ayushmaan Khurana", "M"),
    ("21CSB038", "Sanjana Gupta", "F"),
    ("21CSB039", "Deepika Padukone", "F"),
    ("21CSB040", "Ranveer Singh", "M"),

    # Cluster 5: Core Coders & Competitive Programming
    ("21CSB041", "Manav Sethi", "M"),
    ("21CSB042", "Nandini Murthy", "F"),
    ("21CSB043", "Omkar Deshmukh", "M"),
    ("21CSB044", "Parth Samthaan", "M"),
    ("21CSB045", "Quasar Khan", "M"),
    ("21CSB046", "Radhika Madan", "F"),
    ("21CSB047", "Saurabh Tiwari", "M"),
    ("21CSB048", "Tejaswini Sawant", "F"),
    ("21CSB049", "Uday Chopra", "M"),
    ("21CSB050", "Vedika Pinto", "F"),

    # Cluster 6: Quiet Achievers & Commuters (Moderately isolated or small tight pairs)
    ("21CSB051", "Waseem Akram", "M"),
    ("21CSB052", "Xavier D'Souza", "M"),
    ("21CSB053", "Yamini Krishnamurthy", "F"),
    ("21CSB054", "Zoya Akhtar", "F"),
    ("21CSB055", "Abhimanyu Das", "M"),
    ("21CSB056", "Bhavna Bhatt", "F"),
    ("21CSB057", "Chirag Paswan", "M"),
    ("21CSB058", "Disha Patani", "F"),
    ("21CSB059", "Eshan Hilal", "M"),
    ("21CSB060", "Farhan Akhtar", "M"),
]

async def seed_60():
    await init_db()
    async with async_session_factory() as db:
        # Find or create Section CS-3B
        sec_res = await db.execute(select(Section).where(Section.code == "CS-3B"))
        section = sec_res.scalar_one_or_none()
        if not section:
            section = Section(id="sec-cs3b", code="CS-3B", semester=4, strength=60, department="Computer Science")
            db.add(section)
            await db.flush()

        # Find or create teacher
        tch_res = await db.execute(select(Teacher).limit(1))
        teacher = tch_res.scalar_one_or_none()
        if not teacher:
            teacher = Teacher(id="tch-001", name="Prof. Anand Kumar", department="Computer Science")
            db.add(teacher)
            await db.flush()
        section.class_teacher_id = teacher.id

        # Clubs
        clubs_data = [
            ("club-robotics", "Robotics & Hardware Club"),
            ("club-ai", "AI & Data Science Society"),
            ("club-sports", "College Athletics & Sports"),
            ("club-coding", "Competitive Programming Cell"),
            ("club-cultural", "Cultural & Arts Club"),
        ]
        club_objs = {}
        for cid, cname in clubs_data:
            c_res = await db.execute(select(Club).where(Club.id == cid))
            club = c_res.scalar_one_or_none()
            if not club:
                club = Club(id=cid, name=cname)
                db.add(club)
                await db.flush()
            club_objs[cid] = club

        # Survey Wave
        wave_res = await db.execute(select(SurveyWave).limit(1))
        wave = wave_res.scalar_one_or_none()
        if not wave:
            wave = SurveyWave(id="wave-1", wave_date=date(2026, 9, 1))
            db.add(wave)
            await db.flush()

        # Subjects
        subjects = ["CS301", "CS302", "CS303", "CS304", "MAT201"]
        for scode in subjects:
            s_res = await db.execute(select(Subject).where(Subject.code == scode))
            if not s_res.scalar_one_or_none():
                db.add(Subject(id=f"sub-{scode.lower()}", code=scode, name=f"Subject {scode}", credits=4))
        await db.flush()

        # Insert or update 60 students
        student_records = []
        for roll, name, gender in NAMES_60:
            s_res = await db.execute(select(Student).where(Student.roll_no == roll))
            st = s_res.scalar_one_or_none()
            if not st:
                st = Student(
                    id=str(uuid.uuid4()),
                    roll_no=roll,
                    name=name,
                    section_id=section.id,
                    branch="AIML",
                    year=2,
                    dob=date(2004, (int(roll[-2:]) % 12) + 1, (int(roll[-2:]) % 25) + 1),
                    gender=gender,
                    status="ACTIVE",
                )
                db.add(st)
                await db.flush()
            student_records.append(st)

        # Clear existing data for clean deterministic dataset
        stud_ids = [s.id for s in student_records]
        await db.execute(delete(Attendance).where(Attendance.student_id.in_(stud_ids)))
        await db.execute(delete(SurveyResponse).where(SurveyResponse.wave_id == wave.id))
        await db.execute(delete(ClubMembership).where(ClubMembership.student_id.in_(stud_ids)))
        await db.execute(delete(Observation).where(Observation.student_id.in_(stud_ids)))
        await db.flush()

        # Generate realistic attendance for 20 session days (Oct 1 - Oct 28, 2026)
        dates = [date(2026, 10, 1) + timedelta(days=i) for i in range(25) if (date(2026, 10, 1) + timedelta(days=i)).weekday() < 5][:18]
        
        # Bunk group: students 0-9 co-absent on specific dates
        bunk_dates = [dates[2], dates[6], dates[11], dates[15]]
        sports_dates = [dates[4], dates[9], dates[14]]

        att_to_insert = []
        for s_idx, st in enumerate(student_records):
            for d in dates:
                for period in [1, 2, 3]:
                    scode = subjects[period % len(subjects)]
                    status = "PRESENT"
                    
                    # Bunk clique (students 0..9)
                    if s_idx < 10:
                        if d in bunk_dates and random.random() < 0.85:
                            status = "ABSENT"
                        elif random.random() < 0.15:
                            status = "ABSENT"
                    # Study group (students 10..19)
                    elif 10 <= s_idx < 20:
                        if random.random() < 0.04:
                            status = "ABSENT"
                    # Sports group (students 30..39)
                    elif 30 <= s_idx < 40:
                        if d in sports_dates and random.random() < 0.8:
                            status = "ABSENT"
                        elif random.random() < 0.1:
                            status = "ABSENT"
                    # Others
                    else:
                        if random.random() < 0.12:
                            status = "ABSENT"

                    att_to_insert.append(Attendance(
                        id=str(uuid.uuid4()),
                        student_id=st.id,
                        date=d,
                        period=period,
                        subject_code=scode,
                        status=status
                    ))

        db.add_all(att_to_insert)

        # Add Survey Responses (FRIENDS_WITH, STUDIES_WITH) within clusters and bridge friendships
        survey_to_insert = []
        for c_start in range(0, 60, 10):
            c_members = student_records[c_start:c_start + 10]
            for i in range(len(c_members)):
                for j in range(i + 1, min(i + 4, len(c_members))):
                    u, v = c_members[i], c_members[j]
                    rel = "FRIEND" if c_start != 10 else "STUDY_PARTNER"
                    survey_to_insert.append(SurveyResponse(
                        id=str(uuid.uuid4()), wave_id=wave.id, student_id=u.id, target_id=v.id, relation=rel
                    ))
                    survey_to_insert.append(SurveyResponse(
                        id=str(uuid.uuid4()), wave_id=wave.id, student_id=v.id, target_id=u.id, relation=rel
                    ))
        
        # Cross-cluster bridge friendships (e.g. Cluster 1 & Cluster 2 have 2 bridge connections)
        bridges = [(3, 11), (7, 14), (18, 22), (25, 41), (32, 45)]
        for u_idx, v_idx in bridges:
            u, v = student_records[u_idx], student_records[v_idx]
            survey_to_insert.append(SurveyResponse(
                id=str(uuid.uuid4()), wave_id=wave.id, student_id=u.id, target_id=v.id, relation="FRIEND"
            ))

        db.add_all(survey_to_insert)

        # Club Memberships
        club_assigns = [
            ("club-robotics", range(20, 30)),
            ("club-ai", range(20, 30)),
            ("club-sports", range(30, 40)),
            ("club-coding", range(40, 50)),
            ("club-cultural", range(30, 40)),
        ]
        memberships = []
        for cid, indices in club_assigns:
            for idx in indices:
                memberships.append(ClubMembership(
                    id=str(uuid.uuid4()),
                    student_id=student_records[idx].id,
                    club_id=cid
                ))
        db.add_all(memberships)

        # Teacher Observations (TAGGED_AS) for high-risk / notable students
        observations = [
            Observation(
                id=str(uuid.uuid4()),
                teacher_id=teacher.id,
                student_id=student_records[2].id,
                category="ATTENDANCE",
                note="Repeated mass absence on lab days",
                date=dates[6]
            ),
            Observation(
                id=str(uuid.uuid4()),
                teacher_id=teacher.id,
                student_id=student_records[6].id,
                category="DISCIPLINE",
                note="Leaving campus during period 3",
                date=dates[11]
            ),
            Observation(
                id=str(uuid.uuid4()),
                teacher_id=teacher.id,
                student_id=student_records[11].id,
                category="ACADEMIC",
                note="Peer tutoring coordinator",
                date=dates[1]
            ),
        ]
        db.add_all(observations)

        await db.commit()
        print(f"[OK] Seeded 60 students in Section CS-3B with {len(att_to_insert)} attendance records, "
              f"{len(survey_to_insert)} survey relationships, {len(memberships)} club memberships, "
              f"and observations/interventions.")

if __name__ == "__main__":
    asyncio.run(seed_60())
