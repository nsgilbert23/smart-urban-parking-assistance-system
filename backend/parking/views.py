from rest_framework import viewsets

from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule
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
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer


class ParkingSessionViewSet(viewsets.ModelViewSet):
    queryset = ParkingSession.objects.select_related("vehicle", "slot", "pricing_rule")
    serializer_class = ParkingSessionSerializer
