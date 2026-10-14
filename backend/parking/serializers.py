from rest_framework import serializers

from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule


class OperatorSlotStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ParkingSlot.SlotStatus.AVAILABLE,
            ParkingSlot.SlotStatus.MAINTENANCE,
        )
    )

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        unknown_fields = set(data) - {"status"}
        if unknown_fields:
            raise serializers.ValidationError({
                field: "Unexpected field. Only status may be updated."
                for field in sorted(unknown_fields)
            })
        return values


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
    reserved_vehicle_plate_number = serializers.CharField(source="reserved_vehicle.plate_number", read_only=True)
    reservation_owned_by_current_user = serializers.SerializerMethodField()

    def get_reservation_owned_by_current_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.reserved_vehicle_id and obj.reserved_vehicle.owner_id == user.id)

    class Meta:
        model = ParkingSlot
        fields = (
            "id",
            "zone",
            "zone_name",
            "slot_number",
            "status",
            "sensor_id",
            "reserved_vehicle",
            "reserved_pricing_rule",
            "reserved_vehicle_plate_number",
            "reserved_at",
            "reservation_expires_at",
            "reservation_owned_by_current_user",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "zone_name", "reserved_vehicle", "reserved_pricing_rule", "reserved_vehicle_plate_number", "reserved_at", "reservation_expires_at", "reservation_owned_by_current_user", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        user = getattr(request, "user", None)
        fields["status"].read_only = not (
            user and (user.is_staff or getattr(user, "role", "") in {"ADMIN", "OPERATOR"})
        )
        return fields


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

    slot_number = serializers.CharField(
        source="slot.slot_number",
        read_only=True,
    )
    zone_name = serializers.CharField(source="slot.zone.name", read_only=True)
    slot_status = serializers.CharField(source="slot.status", read_only=True)
    cost_per_hour = serializers.DecimalField(source="pricing_rule.cost_per_hour", max_digits=8, decimal_places=2, read_only=True)
    grace_period_minutes = serializers.IntegerField(source="pricing_rule.grace_period_minutes", read_only=True)

    pricing_rule_name = serializers.CharField(
        source="pricing_rule.name",
        read_only=True,
    )

    class Meta:
        model = ParkingSession
        fields = (
            "id",
            "vehicle",
            "vehicle_plate_number",
            "slot",
            "slot_number",
            "zone_name",
            "slot_status",
            "pricing_rule",
            "pricing_rule_name",
            "cost_per_hour",
            "grace_period_minutes",
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
            "cost_per_hour",
            "grace_period_minutes",
            "duration_minutes",
            "total_cost",
            "end_time",
            "created_at",
            "updated_at",
            "status",
        )

    def validate(self, attrs):
        instance = self.instance

        slot = attrs.get(
            "slot",
            getattr(instance, "slot", None),
        )

        status = attrs.get(
            "status",
            getattr(
                instance,
                "status",
                ParkingSession.SessionStatus.ACTIVE,
            ),
        )

        end_time = attrs.get(
            "end_time",
            getattr(instance, "end_time", None),
        )

        start_time = attrs.get(
            "start_time",
            getattr(
                instance,
                "start_time",
                None,
            ),
        )

        if end_time and start_time and end_time < start_time:
            raise serializers.ValidationError(
                {
                    "end_time": (
                        "End time must be greater than "
                        "or equal to start time."
                    )
                }
            )

        if (
            slot
            and status == ParkingSession.SessionStatus.ACTIVE
        ):
            queryset = ParkingSession.objects.filter(
                slot=slot,
                status=ParkingSession.SessionStatus.ACTIVE,
            )

            if instance:
                queryset = queryset.exclude(
                    pk=instance.pk
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "slot": (
                            "This parking slot already "
                            "has an active session."
                        )
                    }
                )

        return attrs
