from django.core.management.base import BaseCommand
from decimal import Decimal
from fees.models import (
    FeeStructure,
    StudentFeeAssignment,
    FeeSlip,
    FeeCollection,
    Payment,
)


class Command(BaseCommand):
    help = "Reset all fee amounts to zero"

    def handle(self, *args, **options):
        self.stdout.write("Resetting all fee amounts to zero...")

        # Reset FeeStructure
        fee_struct_count = FeeStructure.objects.update(
            amount=Decimal("0.00"),
            late_fee_amount=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {fee_struct_count} FeeStructure records")

        # Reset StudentFeeAssignment
        student_fee_count = StudentFeeAssignment.objects.update(
            custom_amount=Decimal("0.00"),
            discount_percentage=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {student_fee_count} StudentFeeAssignment records")

        # Reset FeeSlip
        fee_slip_count = FeeSlip.objects.update(
            amount=Decimal("0.00"),
            amount_paid=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {fee_slip_count} FeeSlip records")

        # Reset FeeCollection
        fee_collection_count = FeeCollection.objects.update(
            total_expected=Decimal("0.00"),
            total_collected=Decimal("0.00"),
            total_pending=Decimal("0.00"),
            collection_percentage=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {fee_collection_count} FeeCollection records")

        # Optional: Reset Payment amounts to 0 (but maybe keep as is? Let's reset too)
        payment_count = Payment.objects.update(
            amount=Decimal("0.00"),
        )
        self.stdout.write(f"Updated {payment_count} Payment records")

        self.stdout.write(self.style.SUCCESS("All fees reset to 0 successfully!"))
