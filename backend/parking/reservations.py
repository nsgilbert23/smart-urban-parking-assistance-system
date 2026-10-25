from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.models import Notification

from .models import ParkingSlot


def reservation_expiration(started_at=None):
    started_at = started_at or timezone.now()
    return started_at + timedelta(minutes=settings.PARKING_RESERVATION_MINUTES)


@transaction.atomic
def expire_reservations(now=None):
    """Release expired RESERVED slots; safe to call repeatedly."""
    now = now or timezone.now()
    expired = ParkingSlot.objects.select_for_update().filter(
        status=ParkingSlot.SlotStatus.RESERVED,
        reservation_expires_at__lte=now,
    )
    count = 0
    for slot in expired:
        vehicle = slot.reserved_vehicle
        if vehicle:
            Notification.objects.create(
                user=vehicle.owner,
                notification_type=Notification.NotificationType.RESERVATION,
                title="Your parking reservation expired",
                message=(
                    f"Your reservation for {slot.zone.name}, space {slot.slot_number}, "
                    "expired before arrival. Choose an available space to reserve again."
                ),
            )
        slot.status = ParkingSlot.SlotStatus.AVAILABLE
        slot.reserved_vehicle = None
        slot.reserved_pricing_rule = None
        slot.reserved_estimated_duration_minutes = None
        slot.reserved_at = None
        slot.reservation_expires_at = None
        slot.save(update_fields=[
            "status", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes",
            "reserved_at", "reservation_expires_at", "updated_at",
        ])
        count += 1
    return count
