import secrets

from django.core.management.base import BaseCommand, CommandError

from parking.models import ParkingSensor, ParkingSlot


class Command(BaseCommand):
    help = "Provision a parking sensor credential for a configured slot."

    def add_arguments(self, parser):
        parser.add_argument("slot_id", help="UUID of the parking slot to bind")
        parser.add_argument(
            "--device-id",
            help="Optional device identifier; generated securely if omitted",
        )

    def handle(self, *args, **options):
        try:
            slot = ParkingSlot.objects.get(pk=options["slot_id"])
        except (ParkingSlot.DoesNotExist, ValueError) as exc:
            raise CommandError("The specified parking slot does not exist.") from exc

        if not slot.sensor_id:
            raise CommandError(
                "Configure the slot's sensor_id before provisioning its device."
            )
        if ParkingSensor.objects.filter(slot=slot).exists():
            raise CommandError("This parking slot already has a sensor device.")

        device_id = options["device_id"] or f"sensor-{secrets.token_hex(8)}"
        if ParkingSensor.objects.filter(device_id=device_id).exists():
            raise CommandError("That device ID is already in use.")

        secret = secrets.token_urlsafe(32)
        device = ParkingSensor(
            device_id=device_id,
            slot=slot,
        )
        device.set_secret(secret)
        device.save()

        self.stdout.write(self.style.SUCCESS("Sensor device provisioned."))
        self.stdout.write(f"Device ID: {device.device_id}")
        self.stdout.write(f"Device secret (shown once): {secret}")
        self.stdout.write(
            "Store the secret securely now; it cannot be retrieved from the database."
        )
