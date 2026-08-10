from rest_framework import serializers

from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule


class ParkingZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingZone
        fields = (
            "id",
            "name",
            "location",
            "description",
            "total_slots",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ParkingSlotSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = ParkingSlot
        fields = (
            "id",
            "zone",
            "zone_name",
            "slot_number",
            "status",
            "sensor_id",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "zone_name", "created_at", "updated_at")


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = (
            "id",
            "name",
            "cost_per_hour",
            "grace_period_minutes",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ParkingSessionSerializer(serializers.ModelSerializer):
    vehicle_plate_number = serializers.CharField(
        source="vehicle.plate_number",
        read_only=True,
    )
    slot_number = serializers.CharField(source="slot.slot_number", read_only=True)
    pricing_rule_name = serializers.CharField(source="pricing_rule.name", read_only=True)

    class Meta:
        model = ParkingSession
        fields = (
            "id",
            "vehicle",
            "vehicle_plate_number",
            "slot",
            "slot_number",
            "pricing_rule",
            "pricing_rule_name",
            "start_time",
            "end_time",
            "duration_minutes",
            "total_cost",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "vehicle_plate_number",
            "slot_number",
            "pricing_rule_name",
            "duration_minutes",
            "total_cost",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        slot = attrs.get("slot", getattr(instance, "slot", None))
        status = attrs.get(
            "status",
            getattr(instance, "status", ParkingSession.SessionStatus.ACTIVE),
        )
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))

        if end_time and start_time and end_time < start_time:
            raise serializers.ValidationError(
                {"end_time": "End time must be greater than or equal to start time."}
            )

        if slot and status == ParkingSession.SessionStatus.ACTIVE:
            queryset = ParkingSession.objects.filter(
                slot=slot,
                status=ParkingSession.SessionStatus.ACTIVE,
            )
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"slot": "This parking slot already has an active session."}
                )

        return attrs
