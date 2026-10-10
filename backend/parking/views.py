from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status, viewsets
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
    ParkingSessionSerializer, ParkingSlotSerializer,
    ParkingZoneSerializer, PricingRuleSerializer,
)
from .reservations import expire_reservations, reservation_expiration


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
