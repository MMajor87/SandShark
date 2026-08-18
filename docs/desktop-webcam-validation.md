# Desktop Webcam Validation

## Camera support

- `DevicesProvider` enumerates `videoinput` devices, observes device changes, resolves stale saved selections, and persists the selected camera, resolution, and frame rate in `DEVICES_SETTINGS`.
- Devices settings provide a local camera preview using the selected constraints. The preview handles delayed media readiness, configuration changes, permission denial, unavailable devices, and cameras already held by another application.
- The voice controls expose Start Video and Stop Video only to members with the channel webcam permission.
- A webcam producer uses the selected device, resolution, and frame rate. Producer creation now requires an available send transport and releases acquired tracks if producer setup fails.
- A camera ending unexpectedly stops the producer, clears the local preview stream, and synchronizes the server voice state to `webcamEnabled: false`.

## Remote video and quality

- Remote webcam consumers are attached to per-user video elements in the voice stage. Local video is mirrored only when the local preference is enabled.
- When the server and user preferences permit it, webcam publishing negotiates VP8 simulcast with low, medium, and high encodings. A failed simulcast publish falls back to a single webcam producer.
- Remote simulcast consumers expose the existing quality picker. The selected layer preference is retained locally and applied when a consumer is created.
- Transport recovery restores an active webcam after rebuilding the mediasoup device and transports.

## Manual acceptance pass

Use two authenticated desktop clients connected to the authorized test server:

`<authorized-development-server>`

1. Select and save a camera, grant permission, and confirm the preview at more than one resolution/frame-rate choice.
2. Join a voice channel, start and stop video, and confirm the remote client renders the feed and clears it promptly when stopped.
3. With server/user simulcast enabled, change the remote quality selection and confirm the feed remains stable.
4. Unplug or disable a live camera, then confirm the local and remote states clear. Reconnect the network briefly while video is active and confirm the camera resumes after transport recovery.

The automated checks for this phase are static/type/build validation. The manual pass requires authorized accounts and real camera hardware, so SandShark does not create users or test data on the shared server.
