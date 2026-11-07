"""
Shared helpers for caching heavy API list responses.

Report screens (admission cards, result cards, class results ...) re-fetch and
re-serialize large payloads on every click. These helpers let a ViewSet cache
its already-serialized payload in the configured Django cache (Redis) and
invalidate every cached response of a school with a single version bump
whenever that school's data is written.
"""

import hashlib

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from rest_framework.response import Response

# How long a cached list payload may live (seconds). Kept short so that even a
# missed invalidation self-heals quickly.
DEFAULT_CACHE_TIMEOUT = 300

_VERSION_KEY = "api-cache-version:{school}"

# Bumped whenever a write could not be attributed to a single school. Every
# cached entry (of every school) becomes stale, so this is only a safety net.
_GLOBAL_VERSION_KEY = "api-cache-version:global"

# Query params that must never take part in a cache key. They are cache busters
# that change on every request and would otherwise make every entry unique.
_IGNORED_PARAMS = {"_t", "_ts", "_"}


def _incr(key):
    try:
        cache.incr(key)
    except ValueError:
        # incr() raises ValueError when the key does not exist yet.
        cache.set(key, 1, None)
    except Exception:
        pass


def safe_cache_get(key):
    """``cache.get`` that never raises (cache backend may be unreachable)."""
    try:
        return cache.get(key)
    except Exception:
        return None


def safe_cache_set(key, value, timeout=DEFAULT_CACHE_TIMEOUT):
    """``cache.set`` that never raises."""
    try:
        cache.set(key, value, timeout)
    except Exception:
        pass


def to_plain(data):
    """Convert DRF ``ReturnList``/``ReturnDict`` into plain list/dict.

    DRF attaches a hidden ``.serializer`` reference to its response data. That
    reference drags the whole serializer (request, view, queryset) into the
    cache payload, which is huge and often unpicklable. Recursing into lists and
    dicts keeps only the already-serialized primitives.
    """
    if isinstance(data, dict):
        return {key: to_plain(value) for key, value in data.items()}
    if isinstance(data, (list, tuple)):
        return [to_plain(value) for value in data]
    return data


def get_cache_version(school_id):
    """Current cache version of a school (0 when nothing was ever written)."""
    if not school_id:
        return 0
    value = safe_cache_get(_VERSION_KEY.format(school=str(school_id)))
    return value if value is not None else 0


def get_global_cache_version():
    value = safe_cache_get(_GLOBAL_VERSION_KEY)
    return value if value is not None else 0


def bump_cache_version(school_id):
    """Invalidate every cached API response belonging to a school."""
    if not school_id:
        return
    _incr(_VERSION_KEY.format(school=str(school_id)))


def bump_global_cache_version():
    """Invalidate every cached API response of every school (safety net)."""
    _incr(_GLOBAL_VERSION_KEY)


def _query_string(query_params):
    parts = []
    try:
        items = list(query_params.lists())
    except AttributeError:
        items = [(k, [v]) for k, v in (query_params or {}).items()]
    for key, values in sorted(items, key=lambda kv: kv[0]):
        if key in _IGNORED_PARAMS:
            continue
        for value in values:
            parts.append(f"{key}={value}")
    return "&".join(parts)


def build_cache_key(prefix, school_id, user_id, path, query_params):
    raw = (
        f"{prefix}|s={school_id}|u={user_id}"
        f"|gv={get_global_cache_version()}|v={get_cache_version(school_id)}|"
        f"{path}?{_query_string(query_params)}"
    )
    return "api:" + hashlib.sha1(raw.encode("utf-8")).hexdigest()


def make_cache_key(request, prefix):
    """Build a cache key for a DRF request. Returns None when not cacheable."""
    from users.permissions import get_user_school_id

    school_id = get_user_school_id(request.user, request)
    return build_cache_key(
        prefix,
        school_id,
        getattr(request.user, "id", None),
        request.path,
        request.query_params,
    )


class CachedListMixin:
    """Cache a ViewSet's list response for ``cache_timeout`` seconds.

    Usage: add the mixin as the first base class, set ``cache_prefix`` and (if
    the viewset defines its own ``list``) rename that method to
    ``_list_uncached`` so this mixin can wrap it::

        class ResultViewSet(CachedListMixin, viewsets.ModelViewSet):
            cache_prefix = "results-list"

        class SectionViewSet(CachedListMixin, viewsets.ModelViewSet):
            cache_prefix = "sections-list"

            def _list_uncached(self, request, *args, **kwargs):
                ...  # the original list() body

    The key contains the school, the requesting user, the path, all query params
    (minus cache busters) and the school's current cache version, so a single
    version bump invalidates every entry written before a data change.
    """

    cache_prefix = "list"
    cache_timeout = DEFAULT_CACHE_TIMEOUT

    def _list_uncached(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        try:
            key = make_cache_key(request, self.cache_prefix)
        except Exception:
            key = None

        if key:
            cached = safe_cache_get(key)
            if cached is not None:
                return Response(cached)

        response = self._list_uncached(request, *args, **kwargs)

        if key and response.status_code == 200 and response.data is not None:
            safe_cache_set(key, to_plain(response.data), self.cache_timeout)
        return response


# ---------------------------------------------------------------------------
# Invalidation
# ---------------------------------------------------------------------------

def _invalidation_models():
    """Models whose writes can change the payload of a cached report screen."""
    from academics.models import (
        ClassRoom, Section, Subject, StudentProfile, TeacherAssignment,
    )
    from results.models import Examination, ExamSlot, Result
    from attendance.models import AttendanceRecord, StudentAttendanceSummary
    # NOTE: StudentOverallResult is intentionally absent - it is only ever
    # written as a consequence of Result/Examination writes, which are already
    # tracked, and watching it would add a signal per row during rank
    # recalculation (thousands of rows per result save).
    return (
        ClassRoom, Section, Subject, StudentProfile, TeacherAssignment,
        Examination, ExamSlot, Result,
        AttendanceRecord, StudentAttendanceSummary,
    )


def _resolve_school_id(instance):
    """Best-effort school id of an ORM instance (``None`` when unknown).

    Only already-loaded relations are inspected (``_state.fields_cache``) so
    this never fires an extra query - it runs once per saved row, including
    every row touched by rank recalculation.
    """
    if instance is None:
        return None

    school_id = getattr(instance, "school_id", None)
    if school_id:
        return school_id

    fields_cache = getattr(getattr(instance, "_state", None), "fields_cache", None) or {}
    for rel in ("school", "classroom", "student", "examination"):
        related = fields_cache.get(rel)
        if related is None:
            continue
        school_id = getattr(related, "school_id", None)
        if not school_id and rel == "school":
            school_id = getattr(related, "id", None)
        if school_id:
            return school_id
    return None


def _on_data_change(sender, instance, **kwargs):
    try:
        school_id = _resolve_school_id(instance)
    except Exception:
        school_id = None
    if school_id:
        bump_cache_version(school_id)
    else:
        # Cannot attribute the write to a single school -> drop everything.
        bump_global_cache_version()


def connect_cache_invalidation():
    """Wire post_save/post_delete of every tracked model to cache invalidation.

    Called once from an ``AppConfig.ready()`` so that any write to a school's
    data drops every stale report payload of that school.
    """
    for model in _invalidation_models():
        uid = model._meta.label_lower
        post_save.connect(
            _on_data_change, sender=model, weak=False,
            dispatch_uid=f"api-cache-invalidate-save:{uid}",
        )
        post_delete.connect(
            _on_data_change, sender=model, weak=False,
            dispatch_uid=f"api-cache-invalidate-delete:{uid}",
        )
