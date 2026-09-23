from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
