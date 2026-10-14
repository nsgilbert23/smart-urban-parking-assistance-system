"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "smart-urban-parking-backend",
            "api": {
                "auth": "/api/auth/",
                "vehicles": "/api/vehicles/",
                "parking_zones": "/api/parking-zones/",
                "parking_slots": "/api/parking-slots/",
                "pricing_rules": "/api/pricing-rules/",
                "parking_sessions": "/api/parking-sessions/",
                "operator_dashboard": "/api/operator/dashboard/",
            },
        }
    )


urlpatterns = [
    # Health check
    path("", health_check, name="health-check"),

    # Django admin
    path("admin/", admin.site.urls),

    # Authentication
    path("api/auth/", include("accounts.urls")),

    # Vehicles
    path("api/", include("vehicles.urls")),

    # Parking
    path("api/", include("parking.urls")),

    # In-app notifications
    path("api/notifications/", include("notifications.urls")),

    # Reports and analytics
    path("api/reports/", include("reports.urls")),
]
