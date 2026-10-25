# Parking reservation expiration

Set `PARKING_RESERVATION_MINUTES` in the backend environment to configure how long a driver has to arrive. The development default is 15 minutes. Drivers cannot change this setting.

The backend records timezone-aware `reserved_at` and `reservation_expires_at` timestamps when it accepts a reservation. An expired `RESERVED` slot is released when availability is listed, before a new reservation is created, or by running:

```powershell
python manage.py expire_parking_reservations
```

The command is safe to repeat. A scheduled external invocation may run it periodically in deployments that need cleanup even when no driver queries availability.

`RESERVED` means an arrival is expected and has an expiration time. In the website workflow, an operator confirms the driver's arrival; this changes the slot to `OCCUPIED` and creates the active session. At departure, the operator records the exit and payment status, and the slot returns to `AVAILABLE`. Expiration only releases `RESERVED` slots; it never expires `OCCUPIED` slots or active sessions. Sensor event handling remains available as an optional future hardware integration.
