from django.core.management.base import BaseCommand
from decimal import Decimal
from users.models import ActivityLog


class Command(BaseCommand):
    help = "Reset all ActivityLog cost amounts to 0"

    def handle(self, *args, **options):
        self.stdout.write("Resetting all ActivityLog cost amounts to 0...")

        # Reset all ActivityLog cost to 0
        activity_count = ActivityLog.objects.update(
            cost=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {activity_count} ActivityLog records")

        self.stdout.write(self.style.SUCCESS("All ActivityLog costs reset to 0 successfully!"))
