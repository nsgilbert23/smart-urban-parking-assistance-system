from django.db import transaction
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from django.db import transaction
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from .models import (
    ParkingSession,
    ParkingSlot,
    ParkingZone,
    PricingRule,
)
from .serializers import (
    ParkingSessionSerializer,
    ParkingSlotSerializer,
    ParkingZoneSerializer,
    PricingRuleSerializer,
)


class ParkingZoneViewSet(viewsets.ModelViewSet):
    queryset = ParkingZone.objects.all()
    serializer_class = ParkingZoneSerializer


class ParkingSlotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSlot.objects.select_related("zone")
    serializer_class = ParkingSlotSerializer


class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.select_related()
    serializer_class = PricingRuleSerializer


class ParkingSessionViewSet(viewsets.ModelViewSet):
    queryset = ParkingSession.objects.select_related(
        "vehicle",
        "slot",
        "pricing_rule",
    )
    serializer_class = ParkingSessionSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        slot = serializer.validated_data["slot"]

        slot = ParkingSlot.objects.select_for_update().get(
            pk=slot.pk
        )

        if slot.status != ParkingSlot.SlotStatus.AVAILABLE:
            raise ValidationError(
                {
                    "slot": "This parking slot is not available."
                }
            )

        vehicle = serializer.validated_data["vehicle"]

        active_session = ParkingSession.objects.filter(
            vehicle=vehicle,
            status=ParkingSession.SessionStatus.ACTIVE,
        ).exists()

        if active_session:
            raise ValidationError(
                {
                    "vehicle": (
                        "This vehicle already has "
                        "an active parking session."
                    )
                }
            )

        serializer.save(
            slot=slot,
            status=ParkingSession.SessionStatus.ACTIVE,
        )

        slot.status = ParkingSlot.SlotStatus.OCCUPIED
        slot.save(
            update_fields=["status", "updated_at"]
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="end",
    )
    @transaction.atomic
    def end_session(self, request, pk=None):
        session = (
            ParkingSession.objects
            .select_related(
                "vehicle",
                "slot",
                "pricing_rule",
            )
            .select_for_update()
            .get(pk=pk)
        )

        if session.status != ParkingSession.SessionStatus.ACTIVE:
            raise ValidationError(
                {
                    "session": (
                        "This parking session is "
                        "not active."
                    )
                }
            )

        session.end_time = timezone.now()
        session.status = ParkingSession.SessionStatus.COMPLETED
        session.save()

        slot = ParkingSlot.objects.select_for_update().get(
            pk=session.slot.pk
        )

        slot.status = ParkingSlot.SlotStatus.AVAILABLE
        slot.save(
            update_fields=["status", "updated_at"]
        )

        serializer = self.get_serializer(session)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )