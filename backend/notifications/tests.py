from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Notification


class NotificationAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email="notifications@example.com",
            first_name="Notify",
            last_name="Driver",
            password="StrongPass123",
        )
        self.other_user = user_model.objects.create_user(
            email="other-notifications@example.com",
            first_name="Other",
            last_name="Driver",
            password="StrongPass123",
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse("notification-list")
        self.count_url = reverse("notification-unread-count")
        self.read_all_url = reverse("notification-read-all")
        self.first = Notification.objects.create(
            user=self.user,
            notification_type=Notification.NotificationType.GENERAL,
            title="Welcome",
            message="Your account is ready.",
        )
        self.second = Notification.objects.create(
            user=self.user,
            notification_type=Notification.NotificationType.RESERVATION,
            title="Reservation",
            message="Your reservation is active.",
        )
        self.already_read = Notification.objects.create(
            user=self.user,
            title="Earlier update",
            message="This notification was already read.",
            is_read=True,
        )
        self.other_notification = Notification.objects.create(
            user=self.other_user,
            title="Private update",
            message="This belongs to another driver.",
        )

    def test_notification_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.client.get(self.count_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.client.post(self.read_all_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.client.post(
            reverse("notification-read", args=[self.first.id])
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_current_users_notifications_newest_first(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        self.assertNotIn(
            self.other_notification.id,
            {item["id"] for item in response.data},
        )
        self.assertEqual(
            [item["id"] for item in response.data],
            [self.already_read.id, self.second.id, self.first.id],
        )
        self.assertNotIn("user", response.data[0])

    def test_unread_count_is_scoped_to_current_user(self):
        response = self.client.get(self.count_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"count": 2})

    def test_mark_one_notification_as_read(self):
        response = self.client.post(reverse("notification-read", args=[self.first.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])
        self.first.refresh_from_db()
        self.assertTrue(self.first.is_read)

    def test_user_cannot_mark_another_users_notification_as_read(self):
        response = self.client.post(
            reverse("notification-read", args=[self.other_notification.id])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.other_notification.refresh_from_db()
        self.assertFalse(self.other_notification.is_read)

    def test_mark_all_as_read_only_updates_current_users_notifications(self):
        response = self.client.post(self.read_all_url, {"user": str(self.other_user.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"updated": 2})
        self.assertFalse(
            Notification.objects.filter(user=self.user, is_read=False).exists()
        )
        self.other_notification.refresh_from_db()
        self.assertFalse(self.other_notification.is_read)

    def test_invalid_notification_id_returns_not_found(self):
        response = self.client.post(reverse("notification-read", args=[99999999]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
