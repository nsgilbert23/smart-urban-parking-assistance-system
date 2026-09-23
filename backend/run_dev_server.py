import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_PACKAGES = os.path.join(BASE_DIR, "venv", "Lib", "site-packages")

sys.path[:0] = [BASE_DIR, SITE_PACKAGES]
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DB_ENGINE", "sqlite")

from django.core.management import execute_from_command_line

args = sys.argv[1:] or ["runserver", "127.0.0.1:8000", "--noreload"]
execute_from_command_line(["manage.py", *args])
