from decimal import Decimal

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
    operator_name = serializers.SerializerMethodField()

    def get_operator_name(self, obj):
        if not obj.operator_id:
            return None
        return f"{obj.operator.first_name} {obj.operator.last_name}".strip() or obj.operator.email

    class Meta:
        model = ParkingZone
        fields = (
            "id",
            "operator",
            "operator_name",
            "name",
            "location",
            "description",
            "latitude",
            "longitude",
            "total_slots",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "operator_name", "created_at", "updated_at")

    def validate(self, attrs):
        operator = attrs.get("operator")
        if operator and operator.role != "OPERATOR":
            raise serializers.ValidationError({"operator": "Only operator accounts can be assigned to a parking zone."})
        instance = self.instance
        if operator and not operator.is_active and (instance is None or instance.operator_id != operator.id):
            raise serializers.ValidationError({"operator": "Choose an active operator account."})
        latitude = attrs.get("latitude", getattr(instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "Provide both entrance latitude and longitude, or leave both blank."
            )
        return attrs


class NearbyParkingQuerySerializer(serializers.Serializer):
    latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
    )
    longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
    )


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
            "reserved_estimated_duration_minutes",
            "reserved_vehicle_plate_number",
            "reserved_at",
            "reservation_expires_at",
            "reservation_owned_by_current_user",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "zone_name", "reserved_vehicle", "reserved_pricing_rule", "reserved_estimated_duration_minutes", "reserved_vehicle_plate_number", "reserved_at", "reservation_expires_at", "reservation_owned_by_current_user", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        user = getattr(request, "user", None)
        fields["status"].read_only = not (
            user and (user.is_staff or getattr(user, "role", "") in {"ADMIN", "OPERATOR"})
        )
        return fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return data

        can_view_all_reservations = getattr(user, "role", "") in {"ADMIN", "OPERATOR"}
        owns_reservation = bool(
            instance.reserved_vehicle_id
            and instance.reserved_vehicle.owner_id == user.id
        )
        if not can_view_all_reservations and not owns_reservation:
            for field in (
                "reserved_vehicle",
                "reserved_pricing_rule",
                "reserved_estimated_duration_minutes",
                "reserved_vehicle_plate_number",
                "reserved_at",
                "reservation_expires_at",
            ):
                data[field] = None
        if getattr(user, "role", "") == "DRIVER":
            data["sensor_id"] = None
        return data


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
    payment_status = serializers.CharField(read_only=True)
    payment_method = serializers.CharField(read_only=True)
    has_payment_phone_number = serializers.SerializerMethodField()
    latest_mobile_money_status = serializers.SerializerMethodField()

    def get_has_payment_phone_number(self, obj):
        return bool(obj.payment_phone_number)

    def get_latest_mobile_money_status(self, obj):
        attempt = obj.mobile_money_payments.order_by("-created_at").first()
        if not attempt:
            return None
        return {"provider": attempt.provider, "status": attempt.status, "message": attempt.provider_message}

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
            "payment_status",
            "payment_method",
            "has_payment_phone_number",
            "latest_mobile_money_status",
            "estimated_duration_minutes",
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
