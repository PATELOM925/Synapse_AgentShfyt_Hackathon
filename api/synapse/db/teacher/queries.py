"""
Teacher database queries (Prisma SQLite).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OWNER: Teacher developer
Tables: teachers, classrooms, enrollments, syllabi, cohort_snapshots
"""
from __future__ import annotations

import json
import secrets
import string
from datetime import datetime, timedelta, timezone

from synapse.db.client import get_client
from synapse.models import Teacher, Classroom, Enrollment, CohortAnalytics


_INVITE_CODE_LEN = 8
_INVITE_TTL_DAYS = 30


def _new_invite_code(length: int = _INVITE_CODE_LEN) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _to_iso(dt: datetime) -> str:
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


async def _next_invite_code(client) -> str:
    """Generate a unique invite code not used yet."""
    for _ in range(12):
        code = _new_invite_code()
        existing = await client.classroominvitation.find_first(where={"code": code})
        if not existing:
            return code
    raise RuntimeError("Unable to allocate unique classroom invite code")


# ── Teachers ──────────────────────────────────────────────────────────────────

async def upsert_teacher(teacher: Teacher) -> dict:
    client = get_client()
    res = await client.teacher.upsert(
        where={"id": teacher.id},
        data={
            "create": {
                "id": teacher.id,
                "email": teacher.email,
                "name": teacher.name,
                "institution": teacher.institution,
            },
            "update": {
                "email": teacher.email,
                "name": teacher.name,
                "institution": teacher.institution,
            }
        }
    )
    return res.model_dump() if res else {}


async def get_teacher(teacher_id: str) -> dict | None:
    client = get_client()
    res = await client.teacher.find_unique(where={"id": teacher_id})
    return res.model_dump() if res else None


async def get_teacher_by_email(email: str) -> dict | None:
    client = get_client()
    res = await client.teacher.find_unique(where={"email": email})
    return res.model_dump() if res else None


# ── Classrooms ────────────────────────────────────────────────────────────────

async def create_classroom(classroom: Classroom) -> dict:
    client = get_client()
    # join_code handling
    join_code = getattr(classroom, "join_code", None)
    if not join_code:
        join_code = secrets.token_urlsafe(6).upper()
    
    res = await client.classroom.create(
        data={
            "id": classroom.id,
            "teacherId": classroom.teacher_id,
            "name": classroom.name,
            "description": classroom.description,
            "topics": json.dumps(classroom.topics),
            "joinCode": join_code
        }
    )
    
    if not res:
        return {}
    
    r = res.model_dump()
    r["teacher_id"] = r.pop("teacherId", None)
    r["join_code"] = r.pop("joinCode", None)
    try:
        r["topics"] = json.loads(res.topics) if res.topics else []
    except Exception:
        r["topics"] = []
    return r


async def get_classroom(classroom_id: str) -> dict | None:
    client = get_client()
    res = await client.classroom.find_unique(where={"id": classroom_id})
    if not res:
        return None
    r = res.model_dump()
    r["teacher_id"] = r.pop("teacherId", None)
    r["join_code"] = r.pop("joinCode", None)
    try:
        r["topics"] = json.loads(res.topics) if res.topics else []
    except Exception:
        r["topics"] = []
    return r


async def list_teacher_classrooms(teacher_id: str) -> list[dict]:
    client = get_client()
    res = await client.classroom.find_many(
        where={"teacherId": teacher_id},
        order={"createdAt": "desc"}
    )
    
    classes = []
    for r in res:
        c = r.model_dump()
        c["teacher_id"] = c.pop("teacherId", None)
        c["join_code"] = c.pop("joinCode", None)
        try:
            c["topics"] = json.loads(r.topics) if r.topics else []
        except Exception:
            c["topics"] = []
        classes.append(c)
    return classes


async def update_classroom_topics(classroom_id: str, topics: list[str]) -> dict:
    client = get_client()
    res = await client.classroom.update(
        where={"id": classroom_id},
        data={"topics": json.dumps(topics)}
    )
    if not res:
        return {}
    r = res.model_dump()
    r["teacher_id"] = r.pop("teacherId", None)
    r["join_code"] = r.pop("joinCode", None)
    r["topics"] = topics
    return r


async def create_classroom_invite(classroom_id: str, student_id: str, teacher_id: str) -> dict:
    client = get_client()

    existing = await client.classroominvitation.find_first(
        where={
            "classroomId": classroom_id,
            "studentId": student_id,
            "status": "pending"
        },
        order={"createdAt": "desc"}
    )
    if existing:
        r = existing.model_dump()
        r["classroom_id"] = r.pop("classroomId", None)
        r["student_id"] = r.pop("studentId", None)
        r["teacher_id"] = r.pop("teacherId", None)
        r["created_at"] = r.pop("createdAt", None)
        return r

    code = await _next_invite_code(client)
    expires_at = datetime.now(timezone.utc) + timedelta(days=_INVITE_TTL_DAYS)
    
    res = await client.classroominvitation.create(
        data={
            "classroomId": classroom_id,
            "studentId": student_id,
            "teacherId": teacher_id,
            "code": code,
            "status": "pending",
            "expiresAt": expires_at,
        }
    )
    
    r = res.model_dump()
    r["classroom_id"] = r.pop("classroomId", None)
    r["student_id"] = r.pop("studentId", None)
    r["teacher_id"] = r.pop("teacherId", None)
    r["created_at"] = r.pop("createdAt", None)
    return r


async def get_invite_by_code(code: str) -> dict | None:
    client = get_client()
    res = await client.classroominvitation.find_unique(where={"code": code})
    if not res:
        return None
    r = res.model_dump()
    r["classroom_id"] = r.pop("classroomId", None)
    r["student_id"] = r.pop("studentId", None)
    r["teacher_id"] = r.pop("teacherId", None)
    r["created_at"] = r.pop("createdAt", None)
    return r


async def list_classroom_invites(classroom_id: str, status: str | None = None) -> list[dict]:
    client = get_client()
    where_clause = {"classroomId": classroom_id}
    if status:
        where_clause["status"] = status
        
    records = await client.classroominvitation.find_many(
        where=where_clause,
        order={"createdAt": "desc"}
    )
    
    results = []
    for res in records:
        r = res.model_dump()
        r["classroom_id"] = r.pop("classroomId", None)
        r["student_id"] = r.pop("studentId", None)
        r["teacher_id"] = r.pop("teacherId", None)
        r["created_at"] = r.pop("createdAt", None)
        results.append(r)
    return results


async def list_student_invites(student_id: str, status: str | None = None) -> list[dict]:
    client = get_client()
    where_clause = {"studentId": student_id}
    if status:
        where_clause["status"] = status
        
    records = await client.classroominvitation.find_many(
        where=where_clause,
        order={"createdAt": "desc"}
    )
    
    results = []
    for res in records:
        r = res.model_dump()
        r["classroom_id"] = r.pop("classroomId", None)
        r["student_id"] = r.pop("studentId", None)
        r["teacher_id"] = r.pop("teacherId", None)
        r["created_at"] = r.pop("createdAt", None)
        results.append(r)
    return results


async def accept_invite(student_id: str, code: str) -> dict:
    client = get_client()
    now = datetime.now(timezone.utc)
    
    existing = await client.classroominvitation.find_unique(where={"code": code})
    if existing and existing.studentId == student_id and existing.status == "pending":
        res = await client.classroominvitation.update(
            where={"id": existing.id},
            data={"status": "accepted", "acceptedAt": now}
        )
        r = res.model_dump()
        r["classroom_id"] = r.pop("classroomId", None)
        r["student_id"] = r.pop("studentId", None)
        r["teacher_id"] = r.pop("teacherId", None)
        r["created_at"] = r.pop("createdAt", None)
        return r

    return {}


# ── Enrollments ───────────────────────────────────────────────────────────────

async def enroll_student(classroom_id: str, student_id: str) -> dict:
    client = get_client()
    res = await client.enrollment.upsert(
        where={"classroomId_studentId": {"classroomId": classroom_id, "studentId": student_id}},
        data={
            "create": {"classroomId": classroom_id, "studentId": student_id},
            "update": {}
        }
    )
    return res.model_dump() if res else {}


async def list_classroom_students(classroom_id: str) -> list[dict]:
    """Return students enrolled in a classroom with their latest knowledge map."""
    client = get_client()
    enrollments = await client.enrollment.find_many(
        where={"classroomId": classroom_id},
        include={"student": True}
    )
    
    results = []
    for e in enrollments:
        if e.student:
            results.append({
                "student_id": e.studentId,
                "students": e.student.model_dump()
            })
    return results


async def get_student_count(classroom_id: str) -> int:
    client = get_client()
    count = await client.enrollment.count(
        where={"classroomId": classroom_id}
    )
    return count


# ── Syllabi ───────────────────────────────────────────────────────────────────

async def save_syllabus(classroom_id: str, teacher_id: str, topics: list[str], description: str = "") -> dict:
    client = get_client()
    
    existing = await client.syllabus.find_first(
        where={"classroomId": classroom_id}
    )
    
    if existing:
        res = await client.syllabus.update(
            where={"id": existing.id},
            data={
                "teacherId": teacher_id,
                "topics": json.dumps(topics),
                "description": description,
            }
        )
    else:
        res = await client.syllabus.create(
            data={
                "classroomId": classroom_id,
                "teacherId": teacher_id,
                "topics": json.dumps(topics),
                "description": description,
            }
        )
    return res.model_dump() if res else {}


async def get_syllabus(classroom_id: str) -> dict | None:
    client = get_client()
    res = await client.syllabus.find_first(
        where={"classroomId": classroom_id},
        order={"createdAt": "desc"}
    )
    if not res:
        return None
        
    r = res.model_dump()
    try:
        r["topics"] = json.loads(res.topics) if res.topics else []
    except Exception:
        r["topics"] = []
    return r


async def create_classroom_material(
    classroom_id: str,
    teacher_id: str,
    title: str,
    material_url: str,
    content_type: str = "application/pdf",
    description: str = "",
) -> dict:
    client = get_client()
    res = await client.classroommaterial.create(
        data={
            "classroomId": classroom_id,
            "teacherId": teacher_id,
            "title": title,
            "materialUrl": material_url,
            "contentType": content_type,
            "description": description,
        }
    )
    
    r = res.model_dump()
    r["classroom_id"] = r.pop("classroomId", None)
    r["teacher_id"] = r.pop("teacherId", None)
    r["material_url"] = r.pop("materialUrl", None)
    r["content_type"] = r.pop("contentType", None)
    return r


async def list_classroom_materials(classroom_id: str) -> list[dict]:
    client = get_client()
    records = await client.classroommaterial.find_many(
        where={"classroomId": classroom_id},
        order={"createdAt": "desc"}
    )
    
    results = []
    for res in records:
        r = res.model_dump()
        r["classroom_id"] = r.pop("classroomId", None)
        r["teacher_id"] = r.pop("teacherId", None)
        r["material_url"] = r.pop("materialUrl", None)
        r["content_type"] = r.pop("contentType", None)
        results.append(r)
    return results


# ── Cohort Analytics ──────────────────────────────────────────────────────────

async def save_cohort_snapshot(classroom_id: str, analytics: CohortAnalytics) -> dict:
    client = get_client()
    res = await client.cohortsnapshot.create(
        data={
            "classroomId": classroom_id,
            "totalStudents": analytics.total_students,
            "avgMastery": analytics.avg_mastery,
            "topicBreakdown": json.dumps([t.model_dump() for t in analytics.topic_breakdown]),
            "strugglingTopics": json.dumps(analytics.struggling_topics),
        }
    )
    return res.model_dump() if res else {}


async def get_student_knowledge_maps_for_class(classroom_id: str) -> list[dict]:
    """Aggregate all knowledge maps for students in a classroom."""
    client = get_client()
    enrollments = await client.enrollment.find_many(
        where={"classroomId": classroom_id},
        include={
            "student": {
                "include": {
                    "knowledgeMaps": {
                        "order": {"updatedAt": "desc"},
                        "take": 1
                    }
                }
            }
        }
    )
    
    results = []
    for e in enrollments:
        if e.student and e.student.knowledgeMaps:
            km = e.student.knowledgeMaps[0]
            try:
                topics = json.loads(km.topics) if km.topics else []
            except Exception:
                topics = []
                
            results.append({
                "student_id": e.studentId,
                "knowledge_maps": {
                    "student_id": km.studentId,
                    "topics": topics,
                    "overall_mastery": km.overallMastery,
                    "updated_at": km.updatedAt
                }
            })
    return results
