from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ParkingSessionViewSet,
    ParkingSlotViewSet,
    ParkingZoneViewSet,
    PricingRuleViewSet,
    operator_dashboard,
    operator_update_slot_status,
    admin_dashboard,
    admin_create_zone,
    admin_create_slot,
    admin_update_zone,
    admin_update_zone_coordinates,
    nearby_parking,
    sensor_event,
)


router = DefaultRouter()
router.register("parking-zones", ParkingZoneViewSet, basename="parking-zone")
router.register("parking-slots", ParkingSlotViewSet, basename="parking-slot")
router.register("pricing-rules", PricingRuleViewSet, basename="pricing-rule")
router.register("parking-sessions", ParkingSessionViewSet, basename="parking-session")

urlpatterns = [
    path("sensor-events/", sensor_event, name="sensor-event"),
    path("parking/nearby/", nearby_parking, name="nearby-parking"),
    path("admin/dashboard/", admin_dashboard, name="admin-dashboard"),
    path("admin/zones/", admin_create_zone, name="admin-create-zone"),
    path("admin/zones/<uuid:pk>/", admin_update_zone, name="admin-update-zone"),
    path(
        "admin/zones/<uuid:pk>/coordinates/",
        admin_update_zone_coordinates,
        name="admin-update-zone-coordinates",
    ),
    path("admin/slots/", admin_create_slot, name="admin-create-slot"),
    path("operator/dashboard/", operator_dashboard, name="operator-dashboard"),
    path(
        "operator/slots/<uuid:pk>/status/",
        operator_update_slot_status,
        name="operator-slot-status",
    ),
    path("", include(router.urls)),
]
