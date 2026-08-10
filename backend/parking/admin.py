from django.contrib import admin

from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule


class ParkingSlotInline(admin.TabularInline):
    model = ParkingSlot
    extra = 0
    fields = ("slot_number", "status", "sensor_id", "is_active")


@admin.register(ParkingZone)
class ParkingZoneAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "location",
        "total_slots",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("name", "location", "description")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = (ParkingSlotInline,)


@admin.register(ParkingSlot)
class ParkingSlotAdmin(admin.ModelAdmin):
    list_display = (
        "slot_number",
        "zone",
        "status",
        "sensor_id",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "is_active", "zone", "created_at")
    search_fields = ("slot_number", "sensor_id", "zone__name", "zone__location")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("zone",)


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "cost_per_hour",
        "grace_period_minutes",
        "is_default",
        "is_active",
        "created_at",
    )
    list_filter = ("is_default", "is_active", "created_at")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ParkingSession)
class ParkingSessionAdmin(admin.ModelAdmin):
    list_display = (
        "vehicle",
        "slot",
        "pricing_rule",
        "status",
        "start_time",
        "end_time",
        "duration_minutes",
        "total_cost",
    )
    list_filter = ("status", "pricing_rule", "created_at")
    search_fields = (
        "vehicle__plate_number",
        "slot__slot_number",
        "slot__zone__name",
        "pricing_rule__name",
    )
    readonly_fields = (
        "id",
        "duration_minutes",
        "total_cost",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("vehicle", "slot", "pricing_rule")
