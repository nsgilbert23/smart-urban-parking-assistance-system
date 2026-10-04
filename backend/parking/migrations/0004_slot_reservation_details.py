import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("parking", "0003_parkingsession_unique_active_session_per_vehicle"),
        ("vehicles", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="parkingslot",
            name="reserved_vehicle",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="parking_reservations", to="vehicles.vehicle"),
        ),
        migrations.AddField(
            model_name="parkingslot",
            name="reserved_pricing_rule",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="parking_reservations", to="parking.pricingrule"),
        ),
    ]
