from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ParkingSessionViewSet,
    ParkingSlotViewSet,
    ParkingZoneViewSet,
    PricingRuleViewSet,
)


router = DefaultRouter()
router.register("parking-zones", ParkingZoneViewSet, basename="parking-zone")
router.register("parking-slots", ParkingSlotViewSet, basename="parking-slot")
router.register("pricing-rules", PricingRuleViewSet, basename="pricing-rule")
router.register("parking-sessions", ParkingSessionViewSet, basename="parking-session")

urlpatterns = [
    path("", include(router.urls)),
]
