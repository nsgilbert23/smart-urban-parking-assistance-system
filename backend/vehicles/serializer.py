from rest_framework import serializers

from .models import Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Vehicle
        fields = (
            "id",
            "owner",
            "plate_number",
            "vehicle_type",
            "brand",
            "model",
            "color",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")
