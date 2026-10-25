from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from vehicles.models import Vehicle
from notifications.models import Notification

from .models import ParkingSensor, ParkingSession, ParkingSlot, ParkingZone, PricingRule
from .reservations import expire_reservations


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

    def authenticate_admin(self):
        admin = get_user_model().objects.create_user(
            email="parking-admin@example.com",
            first_name="Parking",
            last_name="Admin",
            password="StrongPass123",
            role="ADMIN",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(user=admin)
        return admin

    def create_history_session(
        self, *, status_value, start_time, plate_suffix, end_time=None
    ):
        vehicle = self.vehicle
        if plate_suffix:
            vehicle = Vehicle.objects.create(
                owner=self.user,
                plate_number=f"{plate_suffix}-1",
                brand="Toyota",
                model="Corolla",
                color="Blue",
            )
        zone = ParkingZone.objects.create(
            name=f"History {plate_suffix or 'Main'}",
            location="Main Street",
        )
        slot = ParkingSlot.objects.create(zone=zone, slot_number="H1")
        rule = PricingRule.objects.create(
            name=f"History Rate {plate_suffix or 'Main'}", cost_per_hour="10.00"
        )
        return ParkingSession.objects.create(
            vehicle=vehicle,
            slot=slot,
            pricing_rule=rule,
            start_time=start_time,
            end_time=end_time,
            status=status_value,
        )

    def test_parking_session_list_requires_authentication(self):
        response = APIClient().get("/api/parking-sessions/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_parking_history_contains_all_statuses_and_only_owned_sessions(self):
        now = timezone.now()
        own_sessions = [
            self.create_history_session(
                status_value=session_status,
                start_time=now - timedelta(days=index),
                plate_suffix=session_status,
                end_time=(now - timedelta(days=index - 1))
                if session_status == ParkingSession.SessionStatus.COMPLETED
                else None,
            )
            for index, session_status in enumerate(
                (
                    ParkingSession.SessionStatus.ACTIVE,
                    ParkingSession.SessionStatus.COMPLETED,
                    ParkingSession.SessionStatus.EXPIRED,
                    ParkingSession.SessionStatus.CANCELLED,
                )
            )
        ]
        other = get_user_model().objects.create_user(
            email="history-other@example.com", password="StrongPass123"
        )
        other_vehicle = Vehicle.objects.create(
            owner=other,
            plate_number="OTHER-HISTORY",
            brand="Honda",
            model="Civic",
            color="Black",
        )
        zone = ParkingZone.objects.create(name="Other History", location="Other")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="O1")
        rule = PricingRule.objects.create(name="Other History Rate", cost_per_hour="5.00")
        ParkingSession.objects.create(
            vehicle=other_vehicle,
            slot=slot,
            pricing_rule=rule,
            start_time=now,
            status=ParkingSession.SessionStatus.COMPLETED,
        )

        response = self.client.get("/api/parking-sessions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        self.assertEqual(
            {item["status"] for item in response.data},
            {session.status for session in own_sessions},
        )
        self.assertNotIn("OTHER-HISTORY", {item["vehicle_plate_number"] for item in response.data})
        self.assertEqual(
            [item["start_time"] for item in response.data],
            sorted((item["start_time"] for item in response.data), reverse=True),
        )

    def test_parking_history_filters_by_status_and_start_date_range(self):
        now = timezone.now()
        self.create_history_session(
            status_value=ParkingSession.SessionStatus.COMPLETED,
            start_time=now - timedelta(days=1),
            plate_suffix="RECENT",
            end_time=now,
        )
        self.create_history_session(
            status_value=ParkingSession.SessionStatus.EXPIRED,
            start_time=now - timedelta(days=10),
            plate_suffix="OLDER",
        )

        response = self.client.get(
            "/api/parking-sessions/",
            {
                "status": ParkingSession.SessionStatus.COMPLETED,
                "start_date": (now - timedelta(days=2)).date().isoformat(),
                "end_date": now.date().isoformat(),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["vehicle_plate_number"], "RECENT-1")

    def test_parking_history_rejects_invalid_status_and_date_range(self):
        invalid_status = self.client.get(
            "/api/parking-sessions/", {"status": "UNKNOWN"}
        )
        self.assertEqual(invalid_status.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", invalid_status.data)

        invalid_dates = self.client.get(
            "/api/parking-sessions/",
            {"start_date": "2026-03-02", "end_date": "2026-02-01"},
        )
        self.assertEqual(invalid_dates.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", invalid_dates.data)

    def test_parking_history_keeps_missing_cost_and_end_time_null(self):
        session = self.create_history_session(
            status_value=ParkingSession.SessionStatus.ACTIVE,
            start_time=timezone.now(),
            plate_suffix="ACTIVE",
        )

        response = self.client.get("/api/parking-sessions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = next(value for value in response.data if value["id"] == str(session.id))
        self.assertIsNone(item["end_time"])
        self.assertIsNone(item["duration_minutes"])
        self.assertIsNone(item["total_cost"])

    def test_create_parking_zone(self):
        self.authenticate_admin()
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
        self.authenticate_admin()
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
        self.authenticate_admin()
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
                "estimated_duration_minutes": 120,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ParkingSession.objects.count(), 0)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.RESERVED)
        self.assertEqual(slot.reserved_vehicle, self.vehicle)
        self.assertEqual(slot.reserved_estimated_duration_minutes, 120)
        self.assertTrue(Notification.objects.filter(
            user=self.user, title="Parking reservation confirmed",
        ).exists())
        self.assertIsNotNone(slot.reserved_at)
        self.assertEqual(slot.reservation_expires_at - slot.reserved_at, timedelta(minutes=15))

    @override_settings(PARKING_RESERVATION_MINUTES=23)
    def test_reservation_uses_configured_duration_and_returns_timestamps(self):
        zone = ParkingZone.objects.create(name="Timed Zone", location="Main Street")
        slot = ParkingSlot.objects.create(zone=zone, slot_number="T1")
        rule = PricingRule.objects.create(name="Timed Rate", cost_per_hour="5.00")
        response = self.client.post("/api/parking-sessions/", {
            "vehicle": str(self.vehicle.id), "slot": str(slot.id),
            "pricing_rule": str(rule.id),
            "estimated_duration_minutes": 90,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        slot.refresh_from_db()
        self.assertIsNotNone(slot.reserved_at)
        self.assertEqual(slot.reservation_expires_at - slot.reserved_at, timedelta(minutes=23))
        self.assertIsNotNone(response.data["reserved_at"])
        self.assertEqual(response.data["reservation_expires_at"], slot.reservation_expires_at)

    def test_driver_cannot_see_another_drivers_reservation_details(self):
        other = get_user_model().objects.create_user(
            email="private-driver@example.com", password="StrongPass123"
        )
        other_vehicle = Vehicle.objects.create(
            owner=other,
            plate_number="PRIVATE-PLATE",
            brand="Honda",
            model="Civic",
            color="Black",
        )
        zone = ParkingZone.objects.create(name="Privacy Zone", location="Main Street")
        rule = PricingRule.objects.create(name="Privacy Rate", cost_per_hour="5.00")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="P1", sensor_id="private-sensor",
            status=ParkingSlot.SlotStatus.RESERVED, reserved_vehicle=other_vehicle,
            reserved_pricing_rule=rule, reserved_estimated_duration_minutes=60,
            reserved_at=timezone.now(), reservation_expires_at=timezone.now() + timedelta(minutes=15),
        )

        response = self.client.get("/api/parking-slots/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        serialized = next(item for item in response.data if item["id"] == str(slot.id))
        self.assertIsNone(serialized["reserved_vehicle"])
        self.assertIsNone(serialized["reserved_vehicle_plate_number"])
        self.assertIsNone(serialized["reserved_pricing_rule"])
        self.assertIsNone(serialized["reservation_expires_at"])
        self.assertIsNone(serialized["sensor_id"])

    def test_driver_can_see_their_own_reservation_details(self):
        zone = ParkingZone.objects.create(name="Own Reservation Zone", location="Main Street")
        rule = PricingRule.objects.create(name="Own Reservation Rate", cost_per_hour="5.00")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="O1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_estimated_duration_minutes=60, reserved_at=timezone.now(),
            reservation_expires_at=timezone.now() + timedelta(minutes=15),
        )

        response = self.client.get("/api/parking-slots/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        serialized = next(item for item in response.data if item["id"] == str(slot.id))
        self.assertTrue(serialized["reservation_owned_by_current_user"])
        self.assertEqual(serialized["reserved_vehicle_plate_number"], self.vehicle.plate_number)
        self.assertIsNotNone(serialized["reservation_expires_at"])

    def test_operator_cannot_check_in_an_expired_reservation(self):
        operator = get_user_model().objects.create_user(
            email="assigned-operator@example.com", password="StrongPass123", role="OPERATOR"
        )
        zone = ParkingZone.objects.create(
            name="Expired Arrival Zone", location="Main Street", operator=operator,
        )
        rule = PricingRule.objects.create(name="Expired Arrival Rate", cost_per_hour="5.00")
        expired_at = timezone.now() - timedelta(seconds=1)
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="X1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_at=expired_at - timedelta(minutes=15), reservation_expires_at=expired_at,
        )
        self.client.force_authenticate(user=operator)

        response = self.client.post(f"/api/parking-sessions/{slot.id}/operator-arrival/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.AVAILABLE)
        self.assertIsNone(slot.reserved_vehicle_id)
        self.assertFalse(ParkingSession.objects.filter(slot=slot, status=ParkingSession.SessionStatus.ACTIVE).exists())
        self.assertTrue(Notification.objects.filter(
            user=self.user, title="Your parking reservation expired",
        ).exists())

    def test_operator_check_in_creates_a_driver_notification(self):
        operator = get_user_model().objects.create_user(
            email="checkin-operator@example.com", password="StrongPass123", role="OPERATOR"
        )
        zone = ParkingZone.objects.create(
            name="Check-in Zone", location="Main Street", operator=operator,
        )
        rule = PricingRule.objects.create(name="Check-in Rate", cost_per_hour="5.00")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="C1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_estimated_duration_minutes=60, reserved_at=timezone.now(),
            reservation_expires_at=timezone.now() + timedelta(minutes=15),
        )
        self.client.force_authenticate(user=operator)

        response = self.client.post(f"/api/parking-sessions/{slot.id}/operator-arrival/")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Notification.objects.filter(
            user=self.user, title="Your parking session has started",
        ).exists())

    def test_expiration_releases_only_expired_reserved_slots_and_is_idempotent(self):
        zone = ParkingZone.objects.create(name="Cleanup Zone", location="Main Street")
        rule = PricingRule.objects.create(name="Cleanup Rate", cost_per_hour="5.00")
        expired_at = timezone.now() - timedelta(seconds=1)
        expired = ParkingSlot.objects.create(
            zone=zone, slot_number="E1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_at=expired_at - timedelta(minutes=15), reservation_expires_at=expired_at,
        )
        valid = ParkingSlot.objects.create(
            zone=zone, slot_number="E2", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_at=timezone.now(), reservation_expires_at=timezone.now() + timedelta(minutes=15),
        )
        occupied = ParkingSlot.objects.create(
            zone=zone, slot_number="E3", status=ParkingSlot.SlotStatus.OCCUPIED,
            reservation_expires_at=expired_at,
        )
        active_session = ParkingSession.objects.create(
            vehicle=self.vehicle, slot=occupied, pricing_rule=rule,
            start_time=timezone.now() - timedelta(minutes=5),
        )
        self.assertEqual(expire_reservations(), 1)
        expired.refresh_from_db()
        valid.refresh_from_db()
        occupied.refresh_from_db()
        self.assertEqual(expired.status, ParkingSlot.SlotStatus.AVAILABLE)
        self.assertIsNone(expired.reserved_vehicle_id)
        self.assertIsNone(expired.reserved_pricing_rule_id)
        self.assertIsNone(expired.reserved_at)
        self.assertIsNone(expired.reservation_expires_at)
        self.assertEqual(valid.status, ParkingSlot.SlotStatus.RESERVED)
        self.assertEqual(occupied.status, ParkingSlot.SlotStatus.OCCUPIED)
        active_session.refresh_from_db()
        self.assertEqual(active_session.status, ParkingSession.SessionStatus.ACTIVE)
        self.assertEqual(expire_reservations(), 0)

    def test_driver_can_only_cancel_own_reserved_slot(self):
        zone = ParkingZone.objects.create(name="Cancellation Zone", location="Main Street")
        rule = PricingRule.objects.create(name="Cancellation Rate", cost_per_hour="5.00")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="C1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_pricing_rule=rule,
            reserved_at=timezone.now(), reservation_expires_at=timezone.now() + timedelta(minutes=15),
        )
        response = self.client.post(f"/api/parking-slots/{slot.id}/cancel-reservation/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.AVAILABLE)
        self.assertIsNone(slot.reserved_vehicle_id)
        self.assertIsNone(slot.reserved_pricing_rule_id)
        self.assertIsNone(slot.reserved_at)
        self.assertIsNone(slot.reservation_expires_at)

        other = get_user_model().objects.create_user(email="other@example.com", password="StrongPass123")
        other_vehicle = Vehicle.objects.create(owner=other, plate_number="OTHER-1", brand="Kia", model="Rio", color="Red")
        slot.status = ParkingSlot.SlotStatus.RESERVED
        slot.reserved_vehicle = other_vehicle
        slot.save()
        response = self.client.post(f"/api/parking-slots/{slot.id}/cancel-reservation/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_expired_reservation_sensor_event_does_not_create_session(self):
        zone = ParkingZone.objects.create(name="Expired Sensor Zone", location="Road")
        rule = PricingRule.objects.create(name="Expired Sensor Rate", cost_per_hour="8.00")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="X1", sensor_id="sensor-expired",
            status=ParkingSlot.SlotStatus.RESERVED, reserved_vehicle=self.vehicle,
            reserved_pricing_rule=rule, reserved_at=timezone.now() - timedelta(minutes=16),
            reservation_expires_at=timezone.now() - timedelta(seconds=1),
        )
        client, _, _ = self._sensor_client(slot)
        response = client.post("/api/sensor-events/", {"sensor_id": slot.sensor_id, "occupied": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.OCCUPIED)
        self.assertIsNone(slot.reserved_vehicle_id)
        self.assertFalse(ParkingSession.objects.filter(slot=slot).exists())

    def test_slot_listing_cleans_expired_reservation(self):
        zone = ParkingZone.objects.create(name="Availability Zone", location="Road")
        slot = ParkingSlot.objects.create(
            zone=zone, slot_number="L1", status=ParkingSlot.SlotStatus.RESERVED,
            reserved_vehicle=self.vehicle, reserved_at=timezone.now() - timedelta(minutes=16),
            reservation_expires_at=timezone.now() - timedelta(seconds=1),
        )
        response = self.client.get("/api/parking-slots/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slot.refresh_from_db()
        self.assertEqual(slot.status, ParkingSlot.SlotStatus.AVAILABLE)

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
        slot.reserved_at = timezone.now()
        slot.reservation_expires_at = timezone.now() + timedelta(minutes=15)
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
        self.assertIsNone(slot.reserved_at)
        self.assertIsNone(slot.reservation_expires_at)
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
