import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("parking", "0008_parkingsession_payment_tracking")]

    operations = [
        migrations.AddField(
            model_name="parkingslot",
            name="reserved_estimated_duration_minutes",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parkingsession",
            name="estimated_duration_minutes",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parkingsession",
            name="payment_phone_number",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name="parkingsession",
            name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("CASH", "Cash"),
                    ("MOBILE_MONEY", "Mobile money (recorded)"),
                    ("MTN_MOMO", "MTN MoMo"),
                    ("AIRTEL_MONEY", "Airtel Money"),
                    ("PENDING", "Payment pending"),
                ],
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="MobileMoneyPayment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("provider", models.CharField(choices=[("MTN", "MTN MoMo"), ("AIRTEL", "Airtel Money")], max_length=10)),
                ("provider_reference", models.CharField(max_length=100, unique=True)),
                ("phone_number", models.CharField(max_length=20)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("currency", models.CharField(default="RWF", max_length=3)),
                ("status", models.CharField(choices=[("PENDING", "Pending"), ("SUCCESSFUL", "Successful"), ("FAILED", "Failed")], default="PENDING", max_length=12)),
                ("provider_message", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="mobile_money_payments", to="parking.parkingsession")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
