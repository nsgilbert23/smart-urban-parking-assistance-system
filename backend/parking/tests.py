from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from vehicles.models import Vehicle

from .models import ParkingSession, ParkingSlot, ParkingZone, PricingRule


class ParkingModelTests(TestCase):
    def test_slot_number_is_unique_within_zone(self):
        zone = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=2,
        )
        ParkingSlot.objects.create(zone=zone, slot_number="A1")

        with self.assertRaises(IntegrityError):
            ParkingSlot.objects.create(zone=zone, slot_number="A1")

    def test_same_slot_number_can_exist_in_different_zones(self):
        zone_a = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=1,
        )
        zone_b = ParkingZone.objects.create(
            name="Airport",
            location="Terminal 1",
            total_slots=1,
        )

        ParkingSlot.objects.create(zone=zone_a, slot_number="A1")
        slot = ParkingSlot.objects.create(zone=zone_b, slot_number="A1")

        self.assertEqual(slot.slot_number, "A1")

    def test_parking_slot_can_have_only_one_active_session(self):
        user = get_user_model().objects.create_user(
            email="driver@example.com",
            first_name="Driver",
            last_name="User",
            password="StrongPass123",
        )
        vehicle = Vehicle.objects.create(
            owner=user,
            plate_number="ABC-123",
            brand="Toyota",
            model="Corolla",
            color="Blue",
        )
        second_vehicle = Vehicle.objects.create(
            owner=user,
            plate_number="XYZ-987",
            brand="Honda",
            model="Civic",
            color="Black",
        )
        zone = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=1,
        )
        slot = ParkingSlot.objects.create(zone=zone, slot_number="A1")
        pricing_rule = PricingRule.objects.create(
            name="Standard",
            cost_per_hour="10.00",
            grace_period_minutes=10,
            is_default=True,
        )
        ParkingSession.objects.create(
            vehicle=vehicle,
            slot=slot,
            pricing_rule=pricing_rule,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ParkingSession.objects.create(
                    vehicle=second_vehicle,
                    slot=slot,
                    pricing_rule=pricing_rule,
                )

    def test_completed_sessions_calculate_duration_and_total_cost(self):
        user = get_user_model().objects.create_user(
            email="billing@example.com",
            first_name="Billing",
            last_name="User",
            password="StrongPass123",
        )
        vehicle = Vehicle.objects.create(
            owner=user,
            plate_number="BILL-1",
            brand="Tesla",
            model="Model 3",
            color="White",
        )
        zone = ParkingZone.objects.create(
            name="Airport",
            location="Terminal 1",
            total_slots=1,
        )
        slot = ParkingSlot.objects.create(zone=zone, slot_number="B1")
        pricing_rule = PricingRule.objects.create(
            name="Airport Standard",
            cost_per_hour="12.00",
            grace_period_minutes=15,
        )
        start_time = timezone.now()
        session = ParkingSession.objects.create(
            vehicle=vehicle,
            slot=slot,
            pricing_rule=pricing_rule,
            start_time=start_time,
            end_time=start_time + timedelta(minutes=75),
            status=ParkingSession.SessionStatus.COMPLETED,
        )

        self.assertEqual(session.duration_minutes, 75)
        self.assertEqual(session.total_cost, Decimal("12.00"))


class ParkingAPITests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="parking@example.com",
            first_name="Parking",
            last_name="User",
            password="StrongPass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.vehicle = Vehicle.objects.create(
            owner=self.user,
            plate_number="API-123",
            brand="Toyota",
            model="Corolla",
            color="Blue",
        )

    def test_create_parking_zone(self):
        response = self.client.post(
            "/api/parking-zones/",
            {
                "name": "Downtown",
                "location": "Main Street",
                "description": "Central city parking",
                "total_slots": 10,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParkingZone.objects.count(), 1)

    def test_create_parking_slot(self):
        zone = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=10,
        )

        response = self.client.post(
            "/api/parking-slots/",
            {
                "zone": str(zone.id),
                "slot_number": "A1",
                "status": ParkingSlot.SlotStatus.AVAILABLE,
                "sensor_id": "sensor-001",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParkingSlot.objects.count(), 1)

    def test_create_pricing_rule(self):
        response = self.client.post(
            "/api/pricing-rules/",
            {
                "name": "Standard",
                "cost_per_hour": "10.00",
                "grace_period_minutes": 10,
                "is_default": True,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PricingRule.objects.count(), 1)

    def test_create_parking_session(self):
        zone = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=1,
        )
        slot = ParkingSlot.objects.create(zone=zone, slot_number="A1")
        pricing_rule = PricingRule.objects.create(
            name="Standard",
            cost_per_hour="10.00",
            grace_period_minutes=10,
        )

        response = self.client.post(
            "/api/parking-sessions/",
            {
                "vehicle": str(self.vehicle.id),
                "slot": str(slot.id),
                "pricing_rule": str(pricing_rule.id),
                "status": ParkingSession.SessionStatus.ACTIVE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParkingSession.objects.count(), 1)

    def test_api_rejects_second_active_session_for_same_slot(self):
        zone = ParkingZone.objects.create(
            name="Downtown",
            location="Main Street",
            total_slots=1,
        )
        slot = ParkingSlot.objects.create(zone=zone, slot_number="A1")
        pricing_rule = PricingRule.objects.create(
            name="Standard",
            cost_per_hour="10.00",
            grace_period_minutes=10,
        )
        ParkingSession.objects.create(
            vehicle=self.vehicle,
            slot=slot,
            pricing_rule=pricing_rule,
        )
        second_vehicle = Vehicle.objects.create(
            owner=self.user,
            plate_number="API-456",
            brand="Honda",
            model="Civic",
            color="Black",
        )

        response = self.client.post(
            "/api/parking-sessions/",
            {
                "vehicle": str(second_vehicle.id),
                "slot": str(slot.id),
                "pricing_rule": str(pricing_rule.id),
                "status": ParkingSession.SessionStatus.ACTIVE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ParkingSession.objects.count(), 1)
