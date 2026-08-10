import uuid

from django.conf import settings
from django.db import models


class Vehicle(models.Model):
    class VehicleType(models.TextChoices):
        CAR = "CAR", "Car"
        MOTORCYCLE = "MOTORCYCLE", "Motorcycle"
        VAN = "VAN", "Van"
        TRUCK = "TRUCK", "Truck"
        BUS = "BUS", "Bus"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vehicles",
    )
    plate_number = models.CharField(max_length=20, unique=True)
    vehicle_type = models.CharField(
        max_length=20,
        choices=VehicleType.choices,
        default=VehicleType.CAR,
    )
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    color = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["plate_number"]
        indexes = [
            models.Index(fields=["owner", "is_active"]),
            models.Index(fields=["plate_number"]),
        ]

    def __str__(self):
        return f"{self.plate_number} - {self.brand} {self.model}"
