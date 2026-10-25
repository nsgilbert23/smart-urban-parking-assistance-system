from math import atan2, cos, radians, sin, sqrt
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .authentication import IsParkingSensor, ParkingSensorAuthentication
from .models import MobileMoneyPayment, ParkingSession, ParkingSlot, ParkingZone, PricingRule
from .serializers import (
    NearbyParkingQuerySerializer, OperatorSlotStatusSerializer,
    ParkingSessionSerializer, ParkingSlotSerializer, ParkingZoneSerializer,
    PricingRuleSerializer,
)
from .reservations import expire_reservations, reservation_expiration
from notifications.models import Notification


class IsParkingOperator(permissions.BasePermission):
    message = "An operator account is required to access this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", "") in {"OPERATOR", "ADMIN"}
        )


class IsParkingAdmin(permissions.BasePermission):
    message = "An administrator account is required to access this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", "") == "ADMIN"
        )


@api_view(["GET"])
@permission_classes([IsParkingAdmin])
def admin_dashboard(request):
    """Return platform-wide summary data for the administrator workspace."""
    user_model = get_user_model()
    slot_counts = {
        item["status"]: item["count"]
        for item in ParkingSlot.objects.values("status").annotate(count=Count("id"))
    }
    completed_revenue = ParkingSession.objects.filter(
        status=ParkingSession.SessionStatus.COMPLETED
    ).aggregate(
        total=Coalesce(
            Sum("total_cost"),
            Value(0, output_field=DecimalField(max_digits=12, decimal_places=2)),
        )
    )["total"]
    recent_sessions = ParkingSession.objects.select_related(
        "vehicle", "slot__zone", "pricing_rule"
    ).order_by("-start_time", "-pk")[:8]
    zones = ParkingZone.objects.select_related("operator").annotate(slot_count=Count("slots")).order_by("name")

    return Response({
        "summary": {
            "total_users": user_model.objects.count(),
            "active_users": user_model.objects.filter(is_active=True).count(),
            "drivers": user_model.objects.filter(role="DRIVER").count(),
            "operators": user_model.objects.filter(role="OPERATOR").count(),
            "admins": user_model.objects.filter(role="ADMIN").count(),
            "total_zones": ParkingZone.objects.count(),
            "active_zones": ParkingZone.objects.filter(is_active=True).count(),
            "total_slots": ParkingSlot.objects.count(),
            "available_slots": slot_counts.get(ParkingSlot.SlotStatus.AVAILABLE, 0),
            "occupied_slots": slot_counts.get(ParkingSlot.SlotStatus.OCCUPIED, 0),
            "reserved_slots": slot_counts.get(ParkingSlot.SlotStatus.RESERVED, 0),
            "maintenance_slots": slot_counts.get(ParkingSlot.SlotStatus.MAINTENANCE, 0),
            "active_sessions": ParkingSession.objects.filter(
                status=ParkingSession.SessionStatus.ACTIVE
            ).count(),
            "completed_sessions": ParkingSession.objects.filter(
                status=ParkingSession.SessionStatus.COMPLETED
            ).count(),
            "completed_revenue": completed_revenue,
        },
        "recent_sessions": ParkingSessionSerializer(
            recent_sessions, many=True, context={"request": request}
        ).data,
        "operators": list(user_model.objects.filter(role="OPERATOR").order_by("last_name", "first_name", "email").values("id", "first_name", "last_name", "email", "is_active")),
        "zones": [
            {
                "id": str(zone.id),
                "name": zone.name,
                "location": zone.location,
                "description": zone.description,
                "is_active": zone.is_active,
                "slot_count": zone.slot_count,
                "latitude": str(zone.latitude) if zone.latitude is not None else "",
                "longitude": str(zone.longitude) if zone.longitude is not None else "",
                "operator": str(zone.operator_id) if zone.operator_id else "",
                "operator_name": f"{zone.operator.first_name} {zone.operator.last_name}".strip() if zone.operator_id else "",
            }
            for zone in zones
        ],
    })


@api_view(["POST"])
@permission_classes([IsParkingAdmin])
def admin_create_zone(request):
    """Create a parking zone through the administrator workspace."""
    serializer = ParkingZoneSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    zone = serializer.save(total_slots=0)
    return Response(ParkingZoneSerializer(zone).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsParkingAdmin])
def admin_update_zone_coordinates(request, pk):
    """Set or update a zone's entrance coordinate pair."""
    unexpected_fields = set(request.data) - {"latitude", "longitude"}
    if unexpected_fields:
        raise ValidationError({
            field: "Only latitude and longitude may be updated here."
            for field in sorted(unexpected_fields)
        })
    if set(request.data) != {"latitude", "longitude"}:
        raise ValidationError("Provide both latitude and longitude.")
    zone = get_object_or_404(ParkingZone, pk=pk)
    serializer = ParkingZoneSerializer(zone, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    zone = serializer.save()
    return Response(ParkingZoneSerializer(zone).data)


@api_view(["PATCH"])
@permission_classes([IsParkingAdmin])
def admin_update_zone(request, pk):
    """Update editable parking-zone details from the admin dashboard."""
    allowed_fields = {"name", "location", "description", "latitude", "longitude", "operator"}
    unexpected_fields = set(request.data) - allowed_fields
    if unexpected_fields:
        raise ValidationError({
            field: "This field cannot be updated here."
            for field in sorted(unexpected_fields)
        })
    zone = get_object_or_404(ParkingZone, pk=pk)
    serializer = ParkingZoneSerializer(zone, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    zone = serializer.save()
    return Response(ParkingZoneSerializer(zone).data)


@api_view(["POST"])
@permission_classes([IsParkingAdmin])
@transaction.atomic
def admin_create_slot(request):
    """Create an available parking slot in a selected zone."""
    unexpected_fields = set(request.data) - {"zone", "slot_number"}
    if unexpected_fields:
        raise ValidationError({
            field: "Unexpected field. Only zone and slot_number may be provided."
            for field in sorted(unexpected_fields)
        })
    serializer = ParkingSlotSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    zone = get_object_or_404(
        ParkingZone.objects.select_for_update(),
        pk=serializer.validated_data["zone"].pk,
    )
    slot = serializer.save(zone=zone)
    zone.total_slots = zone.slots.count()
    zone.save(update_fields=["total_slots", "updated_at"])
    return Response(
        ParkingSlotSerializer(slot, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


def _distance_in_meters(latitude_a, longitude_a, latitude_b, longitude_b):
    earth_radius_meters = 6_371_000
    lat_a, lat_b = radians(latitude_a), radians(latitude_b)
    delta_lat = radians(latitude_b - latitude_a)
    delta_lng = radians(longitude_b - longitude_a)
    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(lat_a) * cos(lat_b) * sin(delta_lng / 2) ** 2
    )
    haversine = min(1.0, max(0.0, haversine))
    return 2 * earth_radius_meters * atan2(sqrt(haversine), sqrt(1 - haversine))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def nearby_parking(request):
    """Find available parking near a one-time, unpersisted driver location."""
    query = NearbyParkingQuerySerializer(data=request.data)
    query.is_valid(raise_exception=True)
    latitude = float(query.validated_data["latitude"])
    longitude = float(query.validated_data["longitude"])

    # Release expired reservations so nearby availability matches slot listings.
    expire_reservations()
    zones = ParkingZone.objects.filter(
        is_active=True,
        latitude__isnull=False,
        longitude__isnull=False,
    ).annotate(
        available_spaces=Count(
            "slots",
            filter=Q(
                slots__is_active=True,
                slots__status=ParkingSlot.SlotStatus.AVAILABLE,
            ),
        )
    ).filter(available_spaces__gt=0)

    results = []
    for zone in zones:
        distance = _distance_in_meters(
            latitude,
            longitude,
            float(zone.latitude),
            float(zone.longitude),
        )
        results.append({
            "id": str(zone.id),
            "name": zone.name,
            "location": zone.location,
            "latitude": str(zone.latitude),
            "longitude": str(zone.longitude),
            "available_spaces": zone.available_spaces,
            "distance_meters": round(distance),
        })

    results.sort(key=lambda item: (item["distance_meters"], -item["available_spaces"], item["name"]))
    return Response({"results": results[:3]})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_parking_locations(request):
    """Expose only active parking locations, public rates, and live space counts."""
    expire_reservations()
    zones = ParkingZone.objects.filter(is_active=True).annotate(
        available_spaces=Count(
            "slots",
            filter=Q(slots__is_active=True, slots__status=ParkingSlot.SlotStatus.AVAILABLE),
        ),
        total_spaces=Count("slots", filter=Q(slots__is_active=True)),
    ).order_by("name")
    rule = PricingRule.objects.filter(is_active=True, is_default=True).first()
    if rule is None:
        rule = PricingRule.objects.filter(is_active=True).first()
    return Response({
        "updated_at": timezone.now(),
        "hourly_rate": str(rule.cost_per_hour) if rule else None,
        "currency": "RWF",
        "locations": [{
            "id": str(zone.id), "name": zone.name, "location": zone.location,
            "description": zone.description, "available_spaces": zone.available_spaces,
            "total_spaces": zone.total_spaces,
            "latitude": str(zone.latitude) if zone.latitude is not None else None,
            "longitude": str(zone.longitude) if zone.longitude is not None else None,
        } for zone in zones],
    })


@api_view(["GET"])
@permission_classes([IsParkingOperator])
def operator_dashboard(request):
    """Return the live parking overview for an operator or administrator."""
    expire_reservations()
    operator_zones = ParkingZone.objects.all()
    if request.user.role != "ADMIN":
        operator_zones = operator_zones.filter(operator=request.user)
    zone_ids = operator_zones.values("id")
    slots = list(
        ParkingSlot.objects.filter(zone_id__in=zone_ids).select_related("zone", "reserved_vehicle")
        .order_by("zone__name", "slot_number")
    )
    slot_counts = {
        item["status"]: item["count"]
        for item in ParkingSlot.objects.filter(zone_id__in=zone_ids).values("status").annotate(count=Count("id"))
    }
    zones = operator_zones.annotate(slot_count=Count("slots")).order_by("name")
    active_sessions = ParkingSession.objects.filter(
        slot__zone_id__in=zone_ids,
        status=ParkingSession.SessionStatus.ACTIVE
    ).select_related("vehicle", "slot__zone", "pricing_rule").order_by("start_time")
    pending_payment_sessions = ParkingSession.objects.filter(
        slot__zone_id__in=zone_ids,
        status=ParkingSession.SessionStatus.COMPLETED,
        payment_status__in=("PENDING", "FAILED"),
        mobile_money_payments__isnull=False,
    ).select_related("vehicle", "slot__zone", "pricing_rule").distinct().order_by("-end_time")[:10]

    return Response({
        "summary": {
            "total_slots": len(slots),
            "available_slots": slot_counts.get(ParkingSlot.SlotStatus.AVAILABLE, 0),
            "occupied_slots": slot_counts.get(ParkingSlot.SlotStatus.OCCUPIED, 0),
            "reserved_slots": slot_counts.get(ParkingSlot.SlotStatus.RESERVED, 0),
            "maintenance_slots": slot_counts.get(ParkingSlot.SlotStatus.MAINTENANCE, 0),
            "active_sessions": active_sessions.count(),
        },
        "zones": [
            {
                "id": str(zone.id),
                "name": zone.name,
                "location": zone.location,
                "is_active": zone.is_active,
                "slot_count": zone.slot_count,
            }
            for zone in zones
        ],
        "slots": [
            {
                "id": str(slot.id),
                "zone_id": str(slot.zone_id),
                "zone_name": slot.zone.name,
                "slot_number": slot.slot_number,
                "status": slot.status,
                "is_active": slot.is_active,
                "reserved_vehicle_plate_number": (
                    slot.reserved_vehicle.plate_number if slot.reserved_vehicle_id else None
                ),
                "reservation_expires_at": slot.reservation_expires_at,
                "reserved_estimated_duration_minutes": slot.reserved_estimated_duration_minutes,
            }
            for slot in slots
        ],
        "active_sessions": ParkingSessionSerializer(
            active_sessions, many=True, context={"request": request}
        ).data,
        "pending_payment_sessions": ParkingSessionSerializer(
            pending_payment_sessions, many=True, context={"request": request}
        ).data,
    })


@api_view(["PATCH"])
@permission_classes([IsParkingOperator])
@transaction.atomic
def operator_update_slot_status(request, pk):
    """Allow operators to switch between available and maintenance only."""
    slot = get_object_or_404(
        ParkingSlot.objects.select_for_update().select_related("zone"), pk=pk
    )
    if request.user.role != "ADMIN" and slot.zone.operator_id != request.user.id:
        raise PermissionDenied("This parking location is not assigned to your account.")
    serializer = OperatorSlotStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data["status"]

    if slot.status not in {
        ParkingSlot.SlotStatus.AVAILABLE,
        ParkingSlot.SlotStatus.MAINTENANCE,
    }:
        raise ValidationError({
            "status": "Occupied and reserved slots are managed through arrival and departure confirmations."
        })

    if slot.reserved_vehicle_id or ParkingSession.objects.filter(
        slot=slot, status=ParkingSession.SessionStatus.ACTIVE
    ).exists():
        raise ValidationError({
            "status": "A slot with a reservation or active session cannot be changed."
        })

    if new_status != slot.status:
        slot.status = new_status
        slot.save(update_fields=["status", "updated_at"])
    return Response({
        "id": str(slot.id),
        "zone_name": slot.zone.name,
        "slot_number": slot.slot_number,
        "status": slot.status,
    })


@api_view(["POST"])
@authentication_classes([ParkingSensorAuthentication])
@permission_classes([IsParkingSensor])
@transaction.atomic
def sensor_event(request):
    """Process an occupancy reading from the device assigned to that slot."""
    sensor_id = request.data.get("sensor_id")
    occupied = request.data.get("occupied")
    if not isinstance(sensor_id, str) or not sensor_id.strip() or not isinstance(occupied, bool):
        raise ValidationError({"detail": "sensor_id and boolean occupied are required."})
    device = request.user
    slot = ParkingSlot.objects.select_for_update().get(pk=device.slot_id)
    if slot.sensor_id != sensor_id:
        raise PermissionDenied("This device is not authorized for that sensor.")
    if slot.status == ParkingSlot.SlotStatus.MAINTENANCE:
        raise ValidationError({"slot": "Maintenance slots ignore sensor occupancy events."})

    if occupied:
        if slot.status == ParkingSlot.SlotStatus.RESERVED:
            if slot.reservation_expires_at and slot.reservation_expires_at <= timezone.now():
                slot.status = ParkingSlot.SlotStatus.AVAILABLE
                slot.reserved_vehicle = None
                slot.reserved_pricing_rule = None
                slot.reserved_estimated_duration_minutes = None
                slot.reserved_at = None
                slot.reservation_expires_at = None
                # An unexpected vehicle is reflected as OCCUPIED, without
                # associating it with the expired reservation or creating a session.
                slot.status = ParkingSlot.SlotStatus.OCCUPIED
                slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
                return Response({"sensor_id": sensor_id, "slot_status": slot.status})
            if not slot.reserved_vehicle_id or not slot.reserved_pricing_rule_id:
                raise ValidationError({"slot": "The reservation is incomplete; occupancy was not applied."})
            if ParkingSession.objects.filter(
                vehicle=slot.reserved_vehicle, status=ParkingSession.SessionStatus.ACTIVE,
            ).exists():
                raise ValidationError({"vehicle": "This vehicle already has an active parking session."})
            ParkingSession.objects.create(
                vehicle=slot.reserved_vehicle, slot=slot,
                pricing_rule=slot.reserved_pricing_rule, start_time=timezone.now(),
                estimated_duration_minutes=slot.reserved_estimated_duration_minutes,
                payment_phone_number=slot.reserved_vehicle.owner.phone_number,
            )
            slot.reserved_vehicle = None
            slot.reserved_pricing_rule = None
            slot.reserved_estimated_duration_minutes = None
            slot.reserved_at = None
            slot.reservation_expires_at = None
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        elif slot.status == ParkingSlot.SlotStatus.AVAILABLE:
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
        return Response({"sensor_id": sensor_id, "slot_status": slot.status})

    if slot.status == ParkingSlot.SlotStatus.RESERVED:
        if slot.reservation_expires_at and slot.reservation_expires_at <= timezone.now():
            slot.status = ParkingSlot.SlotStatus.AVAILABLE
            slot.reserved_vehicle = None
            slot.reserved_pricing_rule = None
            slot.reserved_estimated_duration_minutes = None
            slot.reserved_at = None
            slot.reservation_expires_at = None
            slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
            return Response({"sensor_id": sensor_id, "slot_status": slot.status})
        # A false reading does not cancel a driver's reservation.
        return Response({"sensor_id": sensor_id, "slot_status": slot.status})
    if slot.status == ParkingSlot.SlotStatus.OCCUPIED:
        session = ParkingSession.objects.select_for_update().select_related("pricing_rule").filter(
            slot=slot, status=ParkingSession.SessionStatus.ACTIVE,
        ).first()
        if session:
            session.end_time = timezone.now()
            session.status = ParkingSession.SessionStatus.COMPLETED
            session.save(update_fields=["end_time", "duration_minutes", "total_cost", "status", "updated_at"])
        slot.status = ParkingSlot.SlotStatus.AVAILABLE
        slot.save(update_fields=["status", "updated_at"])
    return Response({"sensor_id": sensor_id, "slot_status": slot.status})


class ParkingZoneViewSet(viewsets.ModelViewSet):
    queryset = ParkingZone.objects.all()
    serializer_class = ParkingZoneSerializer

    def get_queryset(self):
        if self.request.user.role == "ADMIN":
            return self.queryset
        if self.request.user.role == "OPERATOR":
            return self.queryset.filter(operator=self.request.user)
        return self.queryset.filter(is_active=True)

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsParkingAdmin()]


class ParkingSlotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSlot.objects.select_related("zone", "reserved_vehicle__owner")
    serializer_class = ParkingSlotSerializer

    def get_queryset(self):
        if self.request.user.role == "OPERATOR":
            return self.queryset.filter(zone__operator=self.request.user)
        if self.request.user.role == "DRIVER":
            return self.queryset.filter(zone__is_active=True, is_active=True)
        return self.queryset

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS or getattr(self, "action", None) == "cancel_reservation":
            return [permissions.IsAuthenticated()]
        return [IsParkingAdmin()]

    def list(self, request, *args, **kwargs):
        expire_reservations()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="cancel-reservation")
    @transaction.atomic
    def cancel_reservation(self, request, pk=None):
        slot = ParkingSlot.objects.select_for_update().select_related("reserved_vehicle").get(pk=pk)
        if slot.status != ParkingSlot.SlotStatus.RESERVED or not slot.reserved_vehicle_id:
            raise ValidationError({"slot": "This slot does not have a cancellable reservation."})
        if slot.reserved_vehicle.owner_id != request.user.id:
            raise PermissionDenied("You can only cancel your own reservation.")
        slot.status = ParkingSlot.SlotStatus.AVAILABLE
        slot.reserved_vehicle = None
        slot.reserved_pricing_rule = None
        slot.reserved_estimated_duration_minutes = None
        slot.reserved_at = None
        slot.reservation_expires_at = None
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
        return Response(ParkingSlotSerializer(slot, context=self.get_serializer_context()).data)


class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsParkingAdmin()]


class ParkingSessionViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    queryset = ParkingSession.objects.select_related("vehicle", "slot__zone", "pricing_rule")
    serializer_class = ParkingSessionSerializer

    def get_permissions(self):
        if getattr(self, "action", None) in {"operator_arrival", "operator_departure"}:
            return [IsParkingOperator()]
        if self.request.method in permissions.SAFE_METHODS or self.request.user.role in {"DRIVER", "ADMIN"}:
            return [permissions.IsAuthenticated()]
        return [IsParkingAdmin()]

    def get_queryset(self):
        queryset = self.queryset
        role = getattr(self.request.user, "role", "")
        if role == "OPERATOR":
            queryset = queryset.filter(slot__zone__operator=self.request.user)
        elif role != "ADMIN":
            queryset = queryset.filter(vehicle__owner=self.request.user)
        params = self.request.query_params
        status_value = params.get("status")
        if status_value:
            status_field = serializers.ChoiceField(
                choices=ParkingSession.SessionStatus.choices
            )
            try:
                status_value = status_field.run_validation(status_value)
            except serializers.ValidationError as error:
                raise ValidationError({"status": error.detail}) from error
            queryset = queryset.filter(status=status_value)

        date_filters = {}
        for param, lookup in (
            ("start_date", "start_time__date__gte"),
            ("end_date", "start_time__date__lte"),
        ):
            value = params.get(param)
            if value:
                try:
                    date_filters[lookup] = serializers.DateField().run_validation(value)
                except serializers.ValidationError as error:
                    raise ValidationError({param: error.detail}) from error

        start_date = date_filters.get("start_time__date__gte")
        end_date = date_filters.get("start_time__date__lte")
        if start_date and end_date and start_date > end_date:
            raise ValidationError({"end_date": "End date must be on or after start date."})
        return queryset.filter(**date_filters).order_by("-start_time")

    @action(detail=True, methods=["post"], url_path="operator-arrival", permission_classes=[IsParkingOperator])
    @transaction.atomic
    def operator_arrival(self, request, pk=None):
        """An operator confirms a driver's reserved vehicle has arrived."""
        slot = ParkingSlot.objects.select_for_update().select_related("zone").get(pk=pk)
        if request.user.role != "ADMIN" and slot.zone.operator_id != request.user.id:
            raise PermissionDenied("This parking location is not assigned to your account.")
        if (
            slot.status == ParkingSlot.SlotStatus.RESERVED
            and slot.reservation_expires_at
            and slot.reservation_expires_at <= timezone.now()
        ):
            expired_vehicle = slot.reserved_vehicle
            slot.status = ParkingSlot.SlotStatus.AVAILABLE
            slot.reserved_vehicle = None
            slot.reserved_pricing_rule = None
            slot.reserved_estimated_duration_minutes = None
            slot.reserved_at = None
            slot.reservation_expires_at = None
            slot.save(update_fields=[
                "status", "reserved_vehicle", "reserved_pricing_rule",
                "reserved_estimated_duration_minutes", "reserved_at",
                "reservation_expires_at", "updated_at",
            ])
            if expired_vehicle:
                Notification.objects.create(
                    user=expired_vehicle.owner,
                    notification_type=Notification.NotificationType.RESERVATION,
                    title="Your parking reservation expired",
                    message=(
                        f"Your reservation for {slot.zone.name}, space {slot.slot_number}, "
                        "expired before arrival. Choose an available space to reserve again."
                    ),
                )
            return Response(
                {"detail": "This reservation has expired. The space is available to reserve again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if slot.status != ParkingSlot.SlotStatus.RESERVED or not slot.reserved_vehicle_id:
            raise ValidationError({"slot": "Only a reserved slot can be checked in."})
        if not slot.reserved_pricing_rule_id or not slot.reserved_pricing_rule.is_active:
            raise ValidationError({"pricing_rule": "The reservation has no active pricing rule."})
        if ParkingSession.objects.filter(vehicle=slot.reserved_vehicle, status=ParkingSession.SessionStatus.ACTIVE).exists():
            raise ValidationError({"vehicle": "This vehicle already has an active session."})
        session = ParkingSession.objects.create(
            vehicle=slot.reserved_vehicle, slot=slot,
            pricing_rule=slot.reserved_pricing_rule, start_time=timezone.now(),
            estimated_duration_minutes=slot.reserved_estimated_duration_minutes,
            payment_phone_number=slot.reserved_vehicle.owner.phone_number,
        )
        Notification.objects.create(
            user=session.vehicle.owner,
            notification_type=Notification.NotificationType.PARKING_SESSION,
            title="Your parking session has started",
            message=(
                f"Your vehicle has been checked in at {slot.zone.name}, "
                f"space {slot.slot_number}. Your parking time is now being recorded."
            ),
        )
        slot.status = ParkingSlot.SlotStatus.OCCUPIED
        slot.reserved_vehicle = None
        slot.reserved_pricing_rule = None
        slot.reserved_estimated_duration_minutes = None
        slot.reserved_at = None
        slot.reservation_expires_at = None
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
        return Response(ParkingSessionSerializer(session, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="operator-departure", permission_classes=[IsParkingOperator])
    def operator_departure(self, request, pk=None):
        """Confirm the exit, calculate the final bill, and optionally request wallet payment."""
        payment_method = request.data.get("payment_method")
        valid_methods = {"CASH", "MTN_MOMO", "AIRTEL_MONEY", "PENDING"}
        if payment_method not in valid_methods:
            raise ValidationError({"payment_method": "Choose cash, MTN MoMo, Airtel Money, or payment pending."})

        mobile_payment = None
        with transaction.atomic():
            session = ParkingSession.objects.select_for_update().select_related(
                "pricing_rule", "slot", "vehicle__owner",
            ).get(pk=pk)
            if request.user.role != "ADMIN" and session.slot.zone.operator_id != request.user.id:
                raise PermissionDenied("This parking location is not assigned to your account.")
            if session.status != ParkingSession.SessionStatus.ACTIVE:
                raise ValidationError({"session": "This parking session is already closed."})
            if payment_method in {"MTN_MOMO", "AIRTEL_MONEY"} and not session.payment_phone_number:
                session.payment_phone_number = session.vehicle.owner.phone_number
            if payment_method in {"MTN_MOMO", "AIRTEL_MONEY"} and not session.payment_phone_number:
                raise ValidationError({"phone_number": "Ask the driver to add a phone number to their profile before mobile money payment."})
            if payment_method in {"MTN_MOMO", "AIRTEL_MONEY"}:
                from billing.providers import PaymentProviderError, normalize_rwanda_phone
                try:
                    normalize_rwanda_phone(session.payment_phone_number)
                except PaymentProviderError as error:
                    raise ValidationError({"phone_number": str(error)}) from error

            session.end_time = timezone.now()
            session.status = ParkingSession.SessionStatus.COMPLETED
            session.payment_method = payment_method
            session.payment_status = "PENDING" if payment_method in {"MTN_MOMO", "AIRTEL_MONEY"} else (
                "PAID" if payment_method == "CASH" else "UNPAID"
            )
            session.save(update_fields=["end_time", "duration_minutes", "total_cost", "status", "payment_status", "payment_method", "payment_phone_number", "updated_at"])
            session.slot.status = ParkingSlot.SlotStatus.AVAILABLE
            session.slot.save(update_fields=["status", "updated_at"])
            if payment_method in {"MTN_MOMO", "AIRTEL_MONEY"}:
                mobile_payment = MobileMoneyPayment.objects.create(
                    session=session,
                    provider="MTN" if payment_method == "MTN_MOMO" else "AIRTEL",
                    provider_reference=str(uuid.uuid4()),
                    phone_number=session.payment_phone_number,
                    amount=session.total_cost or 0,
                    currency="RWF",
                )

        provider_notice = ""
        if mobile_payment:
            from billing.providers import PaymentProviderError, request_collection
            try:
                result = request_collection(
                    mobile_payment.provider,
                    phone=mobile_payment.phone_number,
                    amount=mobile_payment.amount,
                    currency=mobile_payment.currency,
                    reference=mobile_payment.provider_reference,
                )
                mobile_payment.provider_message = result["message"][:255]
                mobile_payment.save(update_fields=["provider_message", "updated_at"])
                provider_notice = "A payment approval prompt was sent to the driver's phone."
            except PaymentProviderError as error:
                mobile_payment.status = MobileMoneyPayment.PaymentStatus.FAILED
                mobile_payment.provider_message = str(error)[:255]
                mobile_payment.save(update_fields=["status", "provider_message", "updated_at"])
                session.payment_status = "FAILED"
                session.save(update_fields=["payment_status", "updated_at"])
                provider_notice = mobile_payment.provider_message

        response_data = ParkingSessionSerializer(session, context={"request": request}).data
        response_data["payment_notice"] = provider_notice
        payment_summary = {
            "CASH": "The fee was recorded as paid in cash.",
            "PENDING": "The fee is recorded as awaiting payment.",
            "MTN_MOMO": (
                "Approve the MTN MoMo prompt on your phone."
                if session.payment_status == "PENDING"
                else "The MTN MoMo request could not be completed. Contact the parking operator."
            ),
            "AIRTEL_MONEY": (
                "Approve the Airtel Money prompt on your phone."
                if session.payment_status == "PENDING"
                else "The Airtel Money request could not be completed. Contact the parking operator."
            ),
        }[payment_method]
        Notification.objects.create(
            user=session.vehicle.owner,
            notification_type=Notification.NotificationType.PARKING_SESSION,
            title="Your parking session has ended",
            message=(
                f"Your session at {session.slot.zone.name}, space {session.slot.slot_number}, "
                f"has ended. Final fee: {session.total_cost or 0} RWF. {payment_summary}"
            ),
        )
        return Response(response_data)

    @action(detail=True, methods=["get"], url_path="payment-status")
    def payment_status(self, request, pk=None):
        session = get_object_or_404(
            ParkingSession.objects.select_related("vehicle__owner", "slot__zone"), pk=pk,
        )
        is_operator = getattr(request.user, "role", "") in {"OPERATOR", "ADMIN"}
        if is_operator and request.user.role != "ADMIN" and session.slot.zone.operator_id != request.user.id:
            raise PermissionDenied("This parking location is not assigned to your account.")
        if not is_operator and session.vehicle.owner_id != request.user.id:
            raise PermissionDenied("You can only view payment status for your own parking session.")
        payment = session.mobile_money_payments.order_by("-created_at").first()
        if not payment:
            raise ValidationError({"payment": "There is no mobile money payment request for this session."})
        if payment.status == MobileMoneyPayment.PaymentStatus.PENDING:
            previous_status = payment.status
            from billing.providers import PaymentProviderError, get_collection_status
            try:
                provider_status, message = get_collection_status(payment)
                if provider_status in {"SUCCESSFUL", "SUCCESS", "COMPLETED", "TS"}:
                    payment.status = MobileMoneyPayment.PaymentStatus.SUCCESSFUL
                    session.payment_status = "PAID"
                elif provider_status in {"FAILED", "REJECTED", "CANCELLED", "TF"}:
                    payment.status = MobileMoneyPayment.PaymentStatus.FAILED
                    session.payment_status = "FAILED"
                if message:
                    payment.provider_message = message[:255]
                payment.save(update_fields=["status", "provider_message", "updated_at"])
                session.save(update_fields=["payment_status", "updated_at"])
                if payment.status != previous_status:
                    Notification.objects.create(
                        user=session.vehicle.owner,
                        notification_type=Notification.NotificationType.PARKING_SESSION,
                        title="Mobile-money payment update",
                        message=(
                            "Your parking payment was successful."
                            if payment.status == MobileMoneyPayment.PaymentStatus.SUCCESSFUL
                            else "Your mobile-money payment did not complete. Contact the parking operator to settle the fee."
                        ),
                    )
            except PaymentProviderError as error:
                payment.provider_message = str(error)[:255]
                payment.save(update_fields=["provider_message", "updated_at"])
        return Response({
            "provider": payment.provider,
            "status": payment.status,
            "message": payment.provider_message,
            "payment_status": session.payment_status,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        slot = ParkingSlot.objects.select_related("zone", "reserved_vehicle").get(
            pk=serializer.validated_data["slot"].pk,
        )
        Notification.objects.create(
            user=request.user,
            notification_type=Notification.NotificationType.RESERVATION,
            title="Parking reservation confirmed",
            message=(
                f"Space {slot.slot_number} at {slot.zone.name} is reserved for your "
                f"vehicle {slot.reserved_vehicle.plate_number}. Arrive before "
                f"{timezone.localtime(slot.reservation_expires_at).strftime('%H:%M')} "
                "and show this reservation to the parking operator."
            ),
        )
        return Response({
            "slot": str(slot.pk), "slot_status": slot.status,
            "vehicle": str(slot.reserved_vehicle_id), "reserved_at": slot.reserved_at,
            "reservation_expires_at": slot.reservation_expires_at,
            "detail": "Parking reserved; show this reservation to the operator on arrival.",
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_create(self, serializer):
        expire_reservations()
        slot = ParkingSlot.objects.select_for_update().get(pk=serializer.validated_data["slot"].pk)
        if slot.status != ParkingSlot.SlotStatus.AVAILABLE or slot.reserved_vehicle_id:
            raise ValidationError({"slot": "This parking slot is not available."})
        vehicle = serializer.validated_data["vehicle"]
        pricing_rule = serializer.validated_data["pricing_rule"]
        estimated_duration_minutes = serializer.validated_data.get("estimated_duration_minutes")
        if estimated_duration_minutes is None or not 1 <= estimated_duration_minutes <= 1440:
            raise ValidationError({"estimated_duration_minutes": "Choose an estimated parking duration between 1 minute and 24 hours."})
        if not pricing_rule.is_active:
            raise ValidationError({"pricing_rule": "Choose an active pricing rule."})
        if vehicle.owner_id != self.request.user.id:
            raise ValidationError({"vehicle": "Choose one of your own vehicles."})
        if ParkingSession.objects.filter(vehicle=vehicle, status=ParkingSession.SessionStatus.ACTIVE).exists():
            raise ValidationError({"vehicle": "This vehicle already has an active parking session."})
        slot.reserved_vehicle = vehicle
        slot.reserved_pricing_rule = pricing_rule
        slot.reserved_estimated_duration_minutes = estimated_duration_minutes
        slot.status = ParkingSlot.SlotStatus.RESERVED
        slot.reserved_at = timezone.now()
        slot.reservation_expires_at = reservation_expiration(slot.reserved_at)
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_at", "reservation_expires_at", "updated_at"])
