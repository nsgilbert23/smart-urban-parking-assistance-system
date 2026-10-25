from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("parking", "0007_parkingzone_latitude_parkingzone_longitude_and_more")]

    operations = [
        migrations.AddField(
            model_name="parkingsession",
            name="payment_status",
            field=models.CharField(default="UNPAID", max_length=10),
        ),
        migrations.AddField(
            model_name="parkingsession",
            name="payment_method",
            field=models.CharField(blank=True, choices=[("CASH", "Cash"), ("MOBILE_MONEY", "Mobile money"), ("PENDING", "Payment pending")], max_length=20),
        ),
    ]
