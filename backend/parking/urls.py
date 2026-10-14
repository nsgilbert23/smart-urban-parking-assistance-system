from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ParkingSessionViewSet,
    ParkingSlotViewSet,
    ParkingZoneViewSet,
    PricingRuleViewSet,
    operator_dashboard,
    operator_update_slot_status,
    sensor_event,
)


router = DefaultRouter()
router.register("parking-zones", ParkingZoneViewSet, basename="parking-zone")
router.register("parking-slots", ParkingSlotViewSet, basename="parking-slot")
router.register("pricing-rules", PricingRuleViewSet, basename="pricing-rule")
router.register("parking-sessions", ParkingSessionViewSet, basename="parking-session")

urlpatterns = [
    path("sensor-events/", sensor_event, name="sensor-event"),
    path("operator/dashboard/", operator_dashboard, name="operator-dashboard"),
    path(
        "operator/slots/<uuid:pk>/status/",
        operator_update_slot_status,
        name="operator-slot-status",
    ),
    path("", include(router.urls)),
]
