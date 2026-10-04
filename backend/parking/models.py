import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth.hashers import check_password, make_password
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from vehicles.models import Vehicle


class ParkingZone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    total_slots = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name


class ParkingSlot(models.Model):
    class SlotStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        OCCUPIED = "OCCUPIED", "Occupied"
        RESERVED = "RESERVED", "Reserved"
        MAINTENANCE = "MAINTENANCE", "Maintenance"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(
        ParkingZone,
        on_delete=models.CASCADE,
        related_name="slots",
    )
    slot_number = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20,
        choices=SlotStatus.choices,
        default=SlotStatus.AVAILABLE,
    )
    sensor_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    reserved_vehicle = models.ForeignKey(
        Vehicle, on_delete=models.SET_NULL, blank=True, null=True,
        related_name="parking_reservations",
    )
    reserved_pricing_rule = models.ForeignKey(
        "PricingRule", on_delete=models.SET_NULL, blank=True, null=True,
        related_name="parking_reservations",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["zone__name", "slot_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["zone", "slot_number"],
                name="unique_slot_number_per_zone",
            ),
        ]
        indexes = [
            models.Index(fields=["zone", "status"]),
            models.Index(fields=["sensor_id"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.zone.name} - {self.slot_number}"


class ParkingSensor(models.Model):
    """A provisioned device credential bound to exactly one parking slot."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(max_length=100, unique=True)
    secret_hash = models.CharField(max_length=256)
    slot = models.OneToOneField(
        ParkingSlot,
        on_delete=models.CASCADE,
        related_name="sensor_device",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def set_secret(self, raw_secret):
        self.secret_hash = make_password(raw_secret)

    def check_secret(self, raw_secret):
        return check_password(raw_secret, self.secret_hash)

    def __str__(self):
        return self.device_id


class PricingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    cost_per_hour = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    grace_period_minutes = models.PositiveIntegerField(default=0)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_default"],
                condition=Q(is_default=True),
                name="unique_default_pricing_rule",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_default"]),
        ]

    def __str__(self):
        return self.name


class ParkingSession(models.Model):
    class SessionStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="parking_sessions",
    )

    slot = models.ForeignKey(
        ParkingSlot,
        on_delete=models.CASCADE,
        related_name="parking_sessions",
    )

    pricing_rule = models.ForeignKey(
        PricingRule,
        on_delete=models.PROTECT,
        related_name="parking_sessions",
    )

    start_time = models.DateTimeField(default=timezone.now)

    end_time = models.DateTimeField(
        blank=True,
        null=True,
    )

    duration_minutes = models.PositiveIntegerField(
        blank=True,
        null=True,
    )

    total_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.ACTIVE,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-start_time"]

        constraints = [
            models.UniqueConstraint(
                fields=["slot"],
                condition=Q(status="ACTIVE"),
                name="unique_active_session_per_slot",
            ),

            models.UniqueConstraint(
                fields=["vehicle"],
                condition=Q(status="ACTIVE"),
                name="unique_active_session_per_vehicle",
            ),

            models.CheckConstraint(
                condition=(
                    Q(end_time__isnull=True)
                    | Q(end_time__gte=models.F("start_time"))
                ),
                name="parking_session_end_time_after_start_time",
            ),
        ]

        indexes = [
            models.Index(
                fields=["slot", "status"]
            ),

            models.Index(
                fields=["vehicle", "status"]
            ),

            models.Index(
                fields=["start_time"]
            ),
        ]

    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            elapsed_seconds = max(
                (self.end_time - self.start_time).total_seconds(),
                0,
            )

            self.duration_minutes = int(
                (elapsed_seconds + 59) // 60
            )

            billable_minutes = max(
                self.duration_minutes
                - self.pricing_rule.grace_period_minutes,
                0,
            )

            hourly_cost = Decimal(
                str(self.pricing_rule.cost_per_hour)
            )

            cost = (
                Decimal(billable_minutes)
                / Decimal(60)
            ) * hourly_cost

            self.total_cost = cost.quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vehicle} at {self.slot} ({self.status})"
