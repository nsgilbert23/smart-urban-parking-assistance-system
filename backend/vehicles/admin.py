from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        "plate_number",
        "owner",
        "vehicle_type",
        "brand",
        "model",
        "color",
        "is_active",
        "created_at",
    )
    list_filter = ("vehicle_type", "is_active", "created_at")
    search_fields = (
        "plate_number",
        "brand",
        "model",
        "color",
        "owner__email",
        "owner__first_name",
        "owner__last_name",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("owner",)
