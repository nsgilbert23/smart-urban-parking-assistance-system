from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class AuthAPITests(APITestCase):
    def setUp(self):
        self.register_url = reverse("register")
        self.login_url = reverse("login")
        self.me_url = reverse("me")
        self.profile_url = reverse("profile")
        self.password = "StrongPass123!"
        self.register_payload = {
            "email": "driver@example.com",
            "first_name": "Test",
            "last_name": "Driver",
            "phone_number": "01000000000",
            "password": self.password,
            "password_confirm": self.password,
        }

    def register_user(self):
        return self.client.post(
            self.register_url,
            self.register_payload,
            format="json",
        )

    def test_register_creates_user(self):
        response = self.register_user()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], self.register_payload["email"])
        self.assertEqual(response.data["first_name"], "Test")
        self.assertEqual(response.data["last_name"], "Driver")
        self.assertEqual(response.data["role"], "DRIVER")
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

    def test_register_rejects_duplicate_email(self):
        self.register_user()

        response = self.register_user()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_rejects_password_mismatch(self):
        payload = {
            **self.register_payload,
            "password_confirm": "DifferentPass123!",
        }

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_register_ignores_invalid_authorization_header(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")

        response = self.register_user()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], self.register_payload["email"])

    def test_login_returns_jwt_tokens_and_user(self):
        self.register_user()

        response = self.client.post(
            self.login_url,
            {
                "email": self.register_payload["email"],
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.register_payload["email"])

    def test_me_requires_jwt_authentication(self):
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_authenticated_user(self):
        self.register_user()
        login_response = self.client.post(
            self.login_url,
            {
                "email": self.register_payload["email"],
                "password": self.password,
            },
            format="json",
        )
        access_token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.register_payload["email"])

    def test_profile_requires_authentication(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_authenticated_user_without_sensitive_fields(self):
        self.register_user()
        user = User.objects.get(email=self.register_payload["email"])
        self.client.force_authenticate(user=user)

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(user.id))
        self.assertEqual(response.data["email"], self.register_payload["email"])
        self.assertEqual(response.data["role"], "DRIVER")
        self.assertNotIn("password", response.data)

    def test_profile_updates_permitted_fields(self):
        self.register_user()
        user = User.objects.get(email=self.register_payload["email"])
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            self.profile_url,
            {
                "first_name": "Updated",
                "last_name": "Name",
                "phone_number": "+250788123456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Updated")
        self.assertEqual(user.last_name, "Name")
        self.assertEqual(user.phone_number, "+250788123456")

    def test_profile_rejects_invalid_input(self):
        self.register_user()
        user = User.objects.get(email=self.register_payload["email"])
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            self.profile_url, {"first_name": ""}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("first_name", response.data)

    def test_profile_rejects_protected_field_updates(self):
        self.register_user()
        user = User.objects.get(email=self.register_payload["email"])
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            self.profile_url,
            {"role": "ADMIN", "is_staff": True, "email": "other@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertEqual(user.role, "DRIVER")
        self.assertFalse(user.is_staff)
        self.assertEqual(user.email, self.register_payload["email"])
