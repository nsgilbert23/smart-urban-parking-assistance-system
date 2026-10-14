from math import atan2, cos, radians, sin, sqrt

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
from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule
from .serializers import (
    NearbyParkingQuerySerializer, OperatorSlotStatusSerializer,
    ParkingSessionSerializer, ParkingSlotSerializer, ParkingZoneSerializer,
    PricingRuleSerializer,
)
from .reservations import expire_reservations, reservation_expiration


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
    zones = ParkingZone.objects.annotate(slot_count=Count("slots")).order_by("name")

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
    allowed_fields = {"name", "location", "description", "latitude", "longitude"}
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
@permission_classes([IsParkingOperator])
def operator_dashboard(request):
    """Return the live parking overview for an operator or administrator."""
    expire_reservations()
    slots = list(
        ParkingSlot.objects.select_related("zone", "reserved_vehicle")
        .order_by("zone__name", "slot_number")
    )
    slot_counts = {
        item["status"]: item["count"]
        for item in ParkingSlot.objects.values("status").annotate(count=Count("id"))
    }
    zones = ParkingZone.objects.annotate(slot_count=Count("slots")).order_by("name")
    active_sessions = ParkingSession.objects.filter(
        status=ParkingSession.SessionStatus.ACTIVE
    ).select_related("vehicle", "slot__zone", "pricing_rule").order_by("start_time")

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
            }
            for slot in slots
        ],
        "active_sessions": ParkingSessionSerializer(
            active_sessions, many=True, context={"request": request}
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
    serializer = OperatorSlotStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data["status"]

    if slot.status not in {
        ParkingSlot.SlotStatus.AVAILABLE,
        ParkingSlot.SlotStatus.MAINTENANCE,
    }:
        raise ValidationError({
            "status": "Occupied and reserved slots are managed by sensors and reservations."
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
    slot = ParkingSlot.objects.select_for_update().select_related(
        "reserved_vehicle", "reserved_pricing_rule",
    ).get(pk=device.slot_id)
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
                slot.reserved_at = None
                slot.reservation_expires_at = None
                # An unexpected vehicle is reflected as OCCUPIED, without
                # associating it with the expired reservation or creating a session.
                slot.status = ParkingSlot.SlotStatus.OCCUPIED
                slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_at", "reservation_expires_at", "updated_at"])
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
            )
            slot.reserved_vehicle = None
            slot.reserved_pricing_rule = None
            slot.reserved_at = None
            slot.reservation_expires_at = None
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        elif slot.status == ParkingSlot.SlotStatus.AVAILABLE:
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_at", "reservation_expires_at", "updated_at"])
        return Response({"sensor_id": sensor_id, "slot_status": slot.status})

    if slot.status == ParkingSlot.SlotStatus.RESERVED:
        if slot.reservation_expires_at and slot.reservation_expires_at <= timezone.now():
            slot.status = ParkingSlot.SlotStatus.AVAILABLE
            slot.reserved_vehicle = None
            slot.reserved_pricing_rule = None
            slot.reserved_at = None
            slot.reservation_expires_at = None
            slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_at", "reservation_expires_at", "updated_at"])
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


class ParkingSlotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSlot.objects.select_related("zone")
    serializer_class = ParkingSlotSerializer

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
        slot.reserved_at = None
        slot.reservation_expires_at = None
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_at", "reservation_expires_at", "updated_at"])
        return Response(ParkingSlotSerializer(slot, context=self.get_serializer_context()).data)


class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer


class ParkingSessionViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    queryset = ParkingSession.objects.select_related("vehicle", "slot__zone", "pricing_rule")
    serializer_class = ParkingSessionSerializer

    def get_queryset(self):
        queryset = self.queryset.filter(vehicle__owner=self.request.user)
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        slot = ParkingSlot.objects.select_related("zone", "reserved_vehicle").get(
            pk=serializer.validated_data["slot"].pk,
        )
        return Response({
            "slot": str(slot.pk), "slot_status": slot.status,
            "vehicle": str(slot.reserved_vehicle_id), "reserved_at": slot.reserved_at,
            "reservation_expires_at": slot.reservation_expires_at,
            "detail": "Parking reserved; the session starts when the sensor confirms occupancy.",
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_create(self, serializer):
        expire_reservations()
        slot = ParkingSlot.objects.select_for_update().get(pk=serializer.validated_data["slot"].pk)
        if slot.status != ParkingSlot.SlotStatus.AVAILABLE or slot.reserved_vehicle_id:
            raise ValidationError({"slot": "This parking slot is not available."})
        vehicle = serializer.validated_data["vehicle"]
        pricing_rule = serializer.validated_data["pricing_rule"]
        if not pricing_rule.is_active:
            raise ValidationError({"pricing_rule": "Choose an active pricing rule."})
        if vehicle.owner_id != self.request.user.id:
            raise ValidationError({"vehicle": "Choose one of your own vehicles."})
        if ParkingSession.objects.filter(vehicle=vehicle, status=ParkingSession.SessionStatus.ACTIVE).exists():
            raise ValidationError({"vehicle": "This vehicle already has an active parking session."})
        slot.reserved_vehicle = vehicle
        slot.reserved_pricing_rule = pricing_rule
        slot.status = ParkingSlot.SlotStatus.RESERVED
        slot.reserved_at = timezone.now()
        slot.reservation_expires_at = reservation_expiration(slot.reserved_at)
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "reserved_at", "reservation_expires_at", "updated_at"])
