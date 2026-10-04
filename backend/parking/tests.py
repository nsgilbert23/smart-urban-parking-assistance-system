from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from vehicles.models import Vehicle

from .models import ParkingSensor, ParkingSession, ParkingSlot, ParkingZone, PricingRule


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
        billable_minutes = max(
            session.duration_minutes - pricing_rule.grace_period_minutes,
            0,
        )
        expected_cost = (
            Decimal(billable_minutes)
            * Decimal(str(pricing_rule.cost_per_hour))
            / Decimal("60")
        ).quantize(Decimal("0.01"))
        self.assertEqual(session.total_cost, expected_cost)


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
        self.assertEqual(ParkingSession.objects.count(), 0)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.RESERVED)
        self.assertEqual(slot.reserved_vehicle, self.vehicle)

    def _sensor_client(
        self,
        slot,
        *,
        device_id="sensor-device-test",
        secret="test-device-secret-not-for-production",
        is_active=True,
    ):
        device = ParkingSensor(device_id=device_id, slot=slot, is_active=is_active)
        device.set_secret(secret)
        device.save()
        client = APIClient()
        client.credentials(
            HTTP_X_DEVICE_ID=device_id,
            HTTP_X_DEVICE_SECRET=secret,
        )
        return client, device, secret

    def test_sensor_event_resolves_slot_and_occupies_available_slot(self):
        zone = ParkingZone.objects.create(name="Sensor Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="S1", sensor_id="sensor-101")
        client, device, secret = self._sensor_client(slot)
        self.assertNotEqual(device.secret_hash, secret)
        response = client.post(
            "/api/sensor-events/", {"sensor_id": "sensor-101", "occupied": True}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.OCCUPIED)

    def test_sensor_departure_completes_session_with_cost_and_duration(self):
        zone = ParkingZone.objects.create(name="Departure Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="S2", sensor_id="sensor-202", status=ParkingSlot.SlotStatus.OCCUPIED)
        rule = PricingRule.objects.create(name="Sensor Rate", cost_per_hour="12.00", grace_period_minutes=15)
        end_time = timezone.now()
        start = end_time - timedelta(minutes=75)
        session = ParkingSession.objects.create(vehicle=self.vehicle, slot=slot, pricing_rule=rule, start_time=start)
        client, _, _ = self._sensor_client(slot)
        with patch("parking.views.timezone.now", return_value=end_time):
            response = client.post(
                "/api/sensor-events/", {"sensor_id": "sensor-202", "occupied": False}, format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.AVAILABLE)
        self.assertEqual(session.status, ParkingSession.SessionStatus.COMPLETED)
        self.assertIsNotNone(session.end_time)
        self.assertGreaterEqual(session.duration_minutes, 75)
        self.assertEqual(session.total_cost, Decimal("12.00"))

    def test_reserved_sensor_occupancy_starts_session(self):
        zone = ParkingZone.objects.create(name="Reservation Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="S3", sensor_id="sensor-303", status=ParkingSlot.SlotStatus.RESERVED, reserved_vehicle=self.vehicle)
        rule = PricingRule.objects.create(name="Reservation Rate", cost_per_hour="8.00")
        slot.reserved_pricing_rule = rule
        slot.save()
        client, _, _ = self._sensor_client(slot)
        response = client.post(
            "/api/sensor-events/", {"sensor_id": "sensor-303", "occupied": True}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.OCCUPIED)
        self.assertIsNone(slot.reserved_vehicle_id)
        self.assertEqual(ParkingSession.objects.filter(slot=slot, status="ACTIVE").count(), 1)

    def test_unoccupied_event_does_not_clear_reservation(self):
        zone = ParkingZone.objects.create(name="Still Reserved", location="Road")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="S6", sensor_id="sensor-606",
            status=ParkingSlot.SlotStatus.RESERVED, reserved_vehicle=self.vehicle,
        )
        client, _, _ = self._sensor_client(slot)
        response = client.post(
            "/api/sensor-events/", {"sensor_id": "sensor-606", "occupied": False}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.RESERVED)

    def test_driver_cannot_send_sensor_event(self):
        zone = ParkingZone.objects.create(name="Protected Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="S4", sensor_id="sensor-404")
        response = self.client.post(
            "/api/sensor-events/", {"sensor_id": "sensor-404", "occupied": True}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.AVAILABLE)

    def test_maintenance_slot_rejects_sensor_event(self):
        zone = ParkingZone.objects.create(name="Maintenance Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="S5", sensor_id="sensor-505", status=ParkingSlot.SlotStatus.MAINTENANCE)
        client, _, _ = self._sensor_client(slot)
        response = client.post(
            "/api/sensor-events/", {"sensor_id": "sensor-505", "occupied": True}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.MAINTENANCE)

    def test_sensor_event_rejects_invalid_device_id(self):
        zone = ParkingZone.objects.create(name="Invalid ID Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="I1", sensor_id="sensor-invalid-id")
        client, _, secret = self._sensor_client(slot)
        client.credentials(HTTP_X_DEVICE_ID="unknown-device", HTTP_X_DEVICE_SECRET=secret)

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_sensor_event_rejects_invalid_device_secret(self):
        zone = ParkingZone.objects.create(name="Invalid Secret Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="I2", sensor_id="sensor-invalid-secret")
        client, device, _ = self._sensor_client(slot)
        client.credentials(
            HTTP_X_DEVICE_ID=device.device_id,
            HTTP_X_DEVICE_SECRET="incorrect-device-secret",
        )

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_sensor_event_rejects_inactive_device(self):
        zone = ParkingZone.objects.create(name="Inactive Device Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="I3", sensor_id="sensor-inactive")
        client, _, _ = self._sensor_client(slot, is_active=False)

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_sensor_event_rejects_unauthenticated_request(self):
        zone = ParkingZone.objects.create(name="Unauthenticated Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="I4", sensor_id="sensor-unauthenticated")

        response = APIClient().post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_one_device_cannot_impersonate_another_sensor(self):
        zone = ParkingZone.objects.create(name="Device Binding Zone", location="Road")
        authorized_slot = ParkingSlot.objects.create(
            zone=zone, slot_number="B1", sensor_id="sensor-bound-one",
        )
        other_slot = ParkingSlot.objects.create(
            zone=zone, slot_number="B2", sensor_id="sensor-bound-two",
        )
        client, _, _ = self._sensor_client(authorized_slot)

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": other_slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        authorized_slot.refresh_from_db()
        other_slot.refresh_from_db()
        self.assertEqual(authorized_slot.status, ParkingSlot.SlotStatus.AVAILABLE)
        self.assertEqual(other_slot.status, ParkingSlot.SlotStatus.AVAILABLE)

    def test_driver_cannot_access_sensor_endpoint_with_device_authentication(self):
        zone = ParkingZone.objects.create(name="Driver Sensor Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="D1", sensor_id="sensor-driver")

        response = self.client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_account_cannot_authenticate_sensor_endpoint(self):
        zone = ParkingZone.objects.create(name="Staff Sensor Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="D2", sensor_id="sensor-staff")
        staff = get_user_model().objects.create_user(
            email="sensor-staff@example.com",
            first_name="Sensor",
            last_name="Staff",
            password="StrongPass123",
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=staff)

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_valid_device_can_report_occupied_true(self):
        zone = ParkingZone.objects.create(name="Valid Device Zone", location="Road")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="V1", sensor_id="sensor-valid")
        client, _, _ = self._sensor_client(slot)

        response = client.post(
            "/api/sensor-events/",
            {"sensor_id": slot.sensor_id, "occupied": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.OCCUPIED)
        self.assertFalse(ParkingSession.objects.filter(slot=slot).exists())

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
