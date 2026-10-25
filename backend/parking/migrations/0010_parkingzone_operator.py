import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("parking", "0009_estimated_time_and_mobile_money"),
    ]

    operations = [
        migrations.AddField(
            model_name="parkingzone",
            name="operator",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={"role": "OPERATOR"},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="managed_parking_zones",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
