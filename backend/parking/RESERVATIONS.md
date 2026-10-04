# Parking reservation expiration

Set `PARKING_RESERVATION_MINUTES` in the backend environment to configure how long a driver has to arrive. The development default is 15 minutes. Drivers cannot change this setting.

The backend records timezone-aware `reserved_at` and `reservation_expires_at` timestamps when it accepts a reservation. An expired `RESERVED` slot is released when availability is listed, before a new reservation is created, or by running:

```powershell
python manage.py expire_parking_reservations
```

The command is safe to repeat. A scheduled external invocation may run it periodically in deployments that need cleanup even when no driver queries availability.

`RESERVED` means an arrival is expected and has an expiration time. An authenticated sensor changes a valid reservation to `OCCUPIED` and creates its active session. Expiration only releases `RESERVED` slots; it never expires `OCCUPIED` slots or active sessions. If an expired reservation receives an occupied sensor reading before cleanup, it is discarded and the slot is represented as occupied without attaching a session to that reservation. The backend is the source of truth for release.
