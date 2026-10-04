from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import ParkingSensor


class ParkingSensorAuthentication(BaseAuthentication):
    """Authenticate a provisioned parking sensor using dedicated HTTP headers."""

    def authenticate(self, request):
        device_id = request.headers.get("X-Device-ID", "").strip()
        device_secret = request.headers.get("X-Device-Secret", "")
        if not device_id and not device_secret:
            return None
        if not device_id or not device_secret:
            raise AuthenticationFailed("Invalid device credentials.")

        try:
            device = ParkingSensor.objects.select_related("slot").get(
                device_id=device_id,
            )
        except ParkingSensor.DoesNotExist:
            raise AuthenticationFailed("Invalid device credentials.")

        if not device.is_active or not device.check_secret(device_secret):
            raise AuthenticationFailed("Invalid device credentials.")

        return device, device

    def authenticate_header(self, request):
        return "Device"


class IsParkingSensor(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, ParkingSensor) and request.user.is_active
