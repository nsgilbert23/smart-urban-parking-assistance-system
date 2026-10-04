# Parking sensor device authentication

The sensor event endpoint uses a dedicated `ParkingSensor` credential bound to
one `ParkingSlot`. It no longer accepts Django staff or driver authentication.
The device secret is stored as a Django password hash; it cannot be read back
after provisioning.

## Provision a development device

1. Configure a slot with its unique `sensor_id` in Django admin.
2. Apply database migrations with `python manage.py migrate`.
3. Provision the device for that slot:

   ```powershell
   python manage.py create_parking_sensor <slot-uuid>
   ```

   Optionally provide a chosen identifier with `--device-id <id>`. The command
   generates a random secret, prints it once, and stores only its hash. Keep the
   printed secret in the device's protected configuration. To disable a device,
   set its `is_active` flag off in Django admin.

## Send a sensor event

Send the credentials in HTTP headers; keep the existing event body unchanged:

```http
POST /api/sensor-events/
Content-Type: application/json
X-Device-ID: <provisioned-device-id>
X-Device-Secret: <provisioned-device-secret>

{"sensor_id":"<slot-sensor-id>","occupied":true}
```

Use HTTPS outside local development. The submitted `sensor_id` must match the
sensor assigned to the device's bound slot. Unknown, incorrect, or disabled
credentials are rejected; a valid device cannot send events for another slot.
The React driver application does not receive or store device credentials.

This development format uses a per-device shared secret over TLS. It does not
yet add request signing, timestamps, or replay tracking; those can be added when
the ESP32 protocol is implemented.
