from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from parking.models import ParkingSession, ParkingSlot, ParkingZone


class IsAdmin(permissions.BasePermission):
    message = "An administrator account is required to access reports."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", "") == "ADMIN"
        )


def _date_parameter(value, name, fallback):
    if value is None:
        return fallback
    try:
        return serializers.DateField().run_validation(value)
    except serializers.ValidationError as error:
        raise ValidationError({name: error.detail}) from error


@api_view(["GET"])
@permission_classes([IsAdmin])
def analytics(request):
    """Return date-filtered parking performance analytics for administrators."""
    today = timezone.localdate()
    end_date = _date_parameter(request.query_params.get("end_date"), "end_date", today)
    start_date = _date_parameter(
        request.query_params.get("start_date"),
        "start_date",
        end_date - timedelta(days=29),
    )
    if start_date > end_date:
        raise ValidationError({"start_date": "Start date must be on or before end date."})
    if end_date - start_date > timedelta(days=365):
        raise ValidationError({"end_date": "Select a date range of 366 days or fewer."})

    sessions = ParkingSession.objects.filter(
        start_time__date__gte=start_date,
        start_time__date__lte=end_date,
    )
    status_counts = {
        item["status"]: item["count"]
        for item in sessions.values("status").annotate(count=Count("id"))
    }
    completed_sessions = sessions.filter(status=ParkingSession.SessionStatus.COMPLETED)
    total_revenue = completed_sessions.aggregate(total=Sum("total_cost"))["total"] or Decimal("0.00")

    daily_counts = {
        item["day"]: item
        for item in sessions.annotate(day=TruncDate("start_time"))
        .values("day")
        .annotate(sessions=Count("id"))
    }
    daily_revenue = {
        item["day"]: item["revenue"] or Decimal("0.00")
        for item in completed_sessions.annotate(day=TruncDate("start_time"))
        .values("day")
        .annotate(revenue=Sum("total_cost"))
    }
    daily = []
    day = start_date
    while day <= end_date:
        daily.append({
            "date": day.isoformat(),
            "sessions": daily_counts.get(day, {}).get("sessions", 0),
            "revenue": daily_revenue.get(day, Decimal("0.00")),
        })
        day += timedelta(days=1)

    zone_sessions = {
        item["slot__zone_id"]: item
        for item in sessions.values("slot__zone_id")
        .annotate(
            sessions=Count("id"),
            completed_revenue=Sum(
                "total_cost",
                filter=Q(status=ParkingSession.SessionStatus.COMPLETED),
            ),
        )
    }
    zones = ParkingZone.objects.annotate(
        slot_count=Count("slots"),
        occupied_slots=Count(
            "slots", filter=Q(slots__status=ParkingSlot.SlotStatus.OCCUPIED)
        ),
        available_slots=Count(
            "slots", filter=Q(slots__status=ParkingSlot.SlotStatus.AVAILABLE)
        ),
        reserved_slots=Count(
            "slots", filter=Q(slots__status=ParkingSlot.SlotStatus.RESERVED)
        ),
        maintenance_slots=Count(
            "slots", filter=Q(slots__status=ParkingSlot.SlotStatus.MAINTENANCE)
        ),
    ).order_by("name")

    user_model = get_user_model()
    return Response({
        "filters": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "summary": {
            "total_sessions": sum(status_counts.values()),
            "active_sessions": status_counts.get(ParkingSession.SessionStatus.ACTIVE, 0),
            "completed_sessions": status_counts.get(ParkingSession.SessionStatus.COMPLETED, 0),
            "cancelled_sessions": status_counts.get(ParkingSession.SessionStatus.CANCELLED, 0),
            "expired_sessions": status_counts.get(ParkingSession.SessionStatus.EXPIRED, 0),
            "completed_revenue": total_revenue,
            "average_completed_session_value": completed_sessions.filter(
                total_cost__isnull=False
            ).aggregate(average=Avg("total_cost"))["average"] or Decimal("0.00"),
            "total_users": user_model.objects.count(),
            "total_zones": zones.count(),
            "total_slots": ParkingSlot.objects.count(),
        },
        "daily": daily,
        "zones": [
            {
                "id": str(zone.id),
                "name": zone.name,
                "is_active": zone.is_active,
                "slot_count": zone.slot_count,
                "occupied_slots": zone.occupied_slots,
                "available_slots": zone.available_slots,
                "reserved_slots": zone.reserved_slots,
                "maintenance_slots": zone.maintenance_slots,
                "sessions": zone_sessions.get(zone.id, {}).get("sessions", 0),
                "completed_revenue": zone_sessions.get(zone.id, {}).get("completed_revenue") or Decimal("0.00"),
            }
            for zone in zones
        ],
    })
