import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    LoginSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .google_auth import verify_google_credential
from notifications.models import Notification


User = get_user_model()
logger = logging.getLogger(__name__)


class GoogleCredentialSerializer(serializers.Serializer):
    credential = serializers.CharField(write_only=True, max_length=10000)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=256)
    new_password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


def issue_auth_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def perform_create(self, serializer):
        user = serializer.save()
        Notification.objects.create(
            user=user,
            notification_type=Notification.NotificationType.GENERAL,
            title="Finish setting up your driver profile",
            message="Add a vehicle before reserving parking. Add a phone number if you want to use mobile-money payments. You can update both from your SUPAS profile.",
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer

    def get_object(self):
        return self.request.user


class GoogleLoginView(generics.GenericAPIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    serializer_class = GoogleCredentialSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_google_credential(serializer.validated_data["credential"])
        subject = claims["sub"]
        email = User.objects.normalize_email(claims["email"])
        user = User.objects.filter(google_sub=subject).first()
        if user is None:
            if User.objects.filter(email__iexact=email).exists():
                raise ValidationError({
                    "detail": "An account already uses this email. Sign in with your password, then connect Google from your profile."
                })
            display_name = (claims.get("name") or "").strip().split()
            first_name = (claims.get("given_name") or (display_name[0] if display_name else ""))[:150]
            last_name = (claims.get("family_name") or " ".join(display_name[1:]))[:150]
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        email=email,
                        password=None,
                        first_name=first_name,
                        last_name=last_name,
                        google_sub=subject,
                        role=User.UserRole.DRIVER,
                    )
                    Notification.objects.create(
                        user=user,
                        notification_type=Notification.NotificationType.GENERAL,
                        title="Finish setting up your driver profile",
                        message="Add a vehicle before reserving parking. Add a phone number if you want to use mobile-money payments. You can update both from your SUPAS profile.",
                    )
            except IntegrityError as error:
                user = User.objects.filter(google_sub=subject).first()
                if user is None:
                    raise ValidationError({"detail": "An account already uses this email. Sign in with your password, then connect Google from your profile."}) from error
        if not user.is_active:
            raise AuthenticationFailed("This SUPAS account is inactive. Contact support.")
        return Response(issue_auth_tokens(user))


class GoogleLinkView(generics.GenericAPIView):
    serializer_class = GoogleCredentialSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_google_credential(serializer.validated_data["credential"])
        email = User.objects.normalize_email(claims["email"])
        if email.casefold() != request.user.email.casefold():
            raise ValidationError({"detail": "Sign in with the Google account that uses this SUPAS email address."})
        other_user = User.objects.filter(google_sub=claims["sub"]).exclude(pk=request.user.pk).first()
        if other_user:
            raise ValidationError({"detail": "This Google account is already connected to another SUPAS account."})
        if request.user.google_sub and request.user.google_sub != claims["sub"]:
            raise ValidationError({"detail": "A different Google account is already connected to this profile."})
        if not request.user.google_sub:
            request.user.google_sub = claims["sub"]
            request.user.save(update_fields=["google_sub"])
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        users = User.objects.filter(email__iexact=email, is_active=True)
        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}"
            try:
                send_mail(
                    "Reset your SUPAS password",
                    (
                        f"Hello {user.first_name or 'there'},\n\n"
                        "We received a request to reset your SUPAS password. Use this link within one hour:\n\n"
                        f"{reset_url}\n\n"
                        "If you did not request this, you can ignore this message."
                    ),
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.exception("Unable to send a SUPAS password reset email.")
        return Response({
            "detail": "If an active account uses that email, password reset instructions have been sent."
        })


class PasswordResetConfirmView(APIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "auth"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            user_id = force_str(urlsafe_base64_decode(values["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, values["token"]):
            raise ValidationError({"token": "This password reset link is invalid or has expired. Request a new link."})

        form = SetPasswordForm(user, {
            "new_password1": values["new_password"],
            "new_password2": values["password_confirm"],
        })
        if not form.is_valid():
            raise ValidationError({"new_password": form.errors.get("new_password2", form.errors.get("new_password1"))})
        form.save()
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        return Response({"detail": "Your password has been reset. Sign in with your new password."})


class LogoutView(APIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError as error:
            raise ValidationError({"refresh": "This refresh token is invalid or expired."}) from error
        return Response(status=status.HTTP_205_RESET_CONTENT)
