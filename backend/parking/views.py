from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .authentication import IsParkingSensor, ParkingSensorAuthentication
from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule
from .serializers import (
    ParkingSessionSerializer, ParkingSlotSerializer,
    ParkingZoneSerializer, PricingRuleSerializer,
)


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
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        elif slot.status == ParkingSlot.SlotStatus.AVAILABLE:
            slot.status = ParkingSlot.SlotStatus.OCCUPIED
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "updated_at"])
        return Response({"sensor_id": sensor_id, "slot_status": slot.status})

    if slot.status == ParkingSlot.SlotStatus.RESERVED:
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


class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer


class ParkingSessionViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    queryset = ParkingSession.objects.select_related("vehicle", "slot__zone", "pricing_rule")
    serializer_class = ParkingSessionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        slot = ParkingSlot.objects.select_related("zone", "reserved_vehicle").get(
            pk=serializer.validated_data["slot"].pk,
        )
        return Response({
            "slot": str(slot.pk), "slot_status": slot.status,
            "vehicle": str(slot.reserved_vehicle_id), "detail": "Parking reserved; the session starts when the sensor confirms occupancy.",
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_create(self, serializer):
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
        slot.save(update_fields=["status", "reserved_vehicle", "reserved_pricing_rule", "updated_at"])
