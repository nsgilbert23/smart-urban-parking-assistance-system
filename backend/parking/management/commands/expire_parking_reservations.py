from django.core.management.base import BaseCommand

from parking.reservations import expire_reservations


class Command(BaseCommand):
    help = "Release parking reservations whose configured arrival window has elapsed."

    def handle(self, *args, **options):
        count = expire_reservations()
        self.stdout.write(self.style.SUCCESS(f"Released {count} expired reservation(s)."))
