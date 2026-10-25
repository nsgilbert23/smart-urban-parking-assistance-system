from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    google_linked = serializers.SerializerMethodField()

    def get_google_linked(self, obj):
        return bool(obj.google_sub)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "google_linked",
            "date_joined",
        )
        read_only_fields = ("id", "role", "date_joined")


class ProfileSerializer(serializers.ModelSerializer):
    """Expose safe profile data and allow edits to contact details only."""

    google_linked = serializers.SerializerMethodField()

    def get_google_linked(self, obj):
        return bool(obj.google_sub)

    PROTECTED_FIELDS = {
        "id",
        "email",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "groups",
        "user_permissions",
        "password",
        "last_login",
        "date_joined",
        "google_sub",
    }

    class Meta:
        model = User
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "role",
            "google_linked",
        )
        read_only_fields = ("id", "email", "role")

    def to_internal_value(self, data):
        protected = self.PROTECTED_FIELDS.intersection(data)
        if protected:
            raise serializers.ValidationError(
                {
                    field: "This field may not be updated."
                    for field in sorted(protected)
                }
            )
        return super().to_internal_value(data)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "password",
            "password_confirm",
        )
        read_only_fields = ("id", "role")

    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
