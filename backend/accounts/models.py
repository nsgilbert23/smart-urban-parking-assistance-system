import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .manager import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    class UserRole(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        OPERATOR = "OPERATOR", "Operator"
        DRIVER = "DRIVER", "Driver"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    google_sub = models.CharField(max_length=255, unique=True, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.DRIVER,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["email"]
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return self.email
