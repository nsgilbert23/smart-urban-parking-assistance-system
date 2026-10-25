from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    GoogleLinkView, GoogleLoginView, LoginView, LogoutView, MeView, ProfileView,
    PasswordResetConfirmView, PasswordResetRequestView, RegisterView,
)


urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("google/link/", GoogleLinkView.as_view(), name="google-link"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/", ProfileView.as_view(), name="profile"),
]
