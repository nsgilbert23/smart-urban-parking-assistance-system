import urllib.error
import logging

import jwt
from django.conf import settings
from jwt import PyJWKClient
from rest_framework.exceptions import APIException, AuthenticationFailed

logger = logging.getLogger(__name__)


_google_jwks = PyJWKClient(
    "https://www.googleapis.com/oauth2/v3/certs",
    cache_jwk_set=True,
    lifespan=300,
)


class GoogleSignInUnavailable(APIException):
    status_code = 503
    default_detail = "Google sign-in is not configured for this application."
    default_code = "google_sign_in_unavailable"


def verify_google_credential(credential):
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "").strip()
    if not client_id:
        raise GoogleSignInUnavailable()
    try:
        signing_key = _google_jwks.get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["accounts.google.com", "https://accounts.google.com"],
            options={"require": ["exp", "iat", "sub", "email"]},
        )
    except (jwt.PyJWTError, urllib.error.URLError, TimeoutError, OSError) as error:
        logger.warning("Google ID token verification failed (%s): %s", type(error).__name__, error)
        detail = "Google could not verify this sign-in. Please try again."
        # Give local developers a useful clue without exposing token contents.
        if settings.DEBUG:
            detail = f"{detail} Verification error: {type(error).__name__}."
        raise AuthenticationFailed(detail) from error
    if claims.get("email_verified") is not True:
        raise AuthenticationFailed("Use a Google account with a verified email address.")
    return claims
