# SiteSentinel Android Glasses Integration

This Android app integrates with Meta Ray-Ban glasses to stream camera frames to the SiteSentinel inspection API for real-time hazard detection.

## Architecture

The app is designed to:
1. Connect to Meta Ray-Ban glasses via the Wearables Device Access Toolkit
2. Subscribe to the camera stream
3. Capture frames at regular intervals
4. Send frames to the SiteSentinel API for hazard detection
5. Display alerts for detected hazards

## Setup

### Prerequisites

- Android Studio Arctic Fox or later
- Android SDK 28+ (Android 9.0+)
- Meta Wearables Device Access Toolkit SDK
- Paired Meta Ray-Ban glasses (for production use)

### Building

1. Open the project in Android Studio:
   ```bash
   cd android
   # Open in Android Studio or run:
   ./gradlew build
   ```

2. Configure API endpoint in `MainActivity.kt`:
   ```kotlin
   private val API_URL = "https://your-api-url.lambda-url.us-east-1.on.aws"
   ```

3. Build and install:
   ```bash
   ./gradlew installDebug
   ```

## Testing with Mock Device Kit

For development without physical glasses, use the Meta Mock Device Kit:

1. Install Meta Mock Device Kit from Meta Developer Portal
2. Start the mock glasses simulator
3. The app will connect to the simulated device
4. Mock frames will be sent to the inspection API

### Mock Mode

The app includes a mock mode for testing without glasses or the Mock Device Kit:
- Generates minimal JPEG frames every 10 seconds
- Sends them to the inspection API
- Displays toast notifications for detected hazards

## Production Integration

To integrate with real Meta Ray-Ban glasses:

1. Add the Meta Wearables SDK dependency in `app/build.gradle.kts`:
   ```kotlin
   implementation("com.meta.wearables:deviceaccess:1.0.0")
   ```

2. Update `initializeGlassesConnection()` in `MainActivity.kt`:
   ```kotlin
   val deviceManager = WearableDeviceManager.getInstance(this)
   deviceManager.scanForDevices { device ->
       if (device.type == DeviceType.RAY_BAN_GLASSES) {
           deviceManager.connect(device) { connected ->
               if (connected) {
                   subscribeToCameraStream(device)
               }
           }
       }
   }
   ```

3. Implement camera stream subscription:
   ```kotlin
   device.subscribeToCameraStream(
       resolution = CameraResolution.HD_720P,
       frameRate = 10
   ) { frame ->
       onCameraFrame(frame.imageData)
   }
   ```

## API Integration

The app sends POST requests to `/inspect` with:
```json
{
  "image": "base64-encoded-jpeg",
  "rulePackId": "construction",
  "zone": "site-main",
  "siteId": "demo-site",
  "returnOverlay": true
}
```

Responses include detected issues and overlay URLs.

## Permissions

Required Android permissions:
- `CAMERA`: Access device camera (for Mock Device Kit simulation)
- `INTERNET`: API communication
- Additional permissions may be required by the Wearables SDK

## Troubleshooting

### Glasses not connecting
- Ensure glasses are paired via Bluetooth settings
- Check that Wearables SDK is properly initialized
- Verify glasses firmware is up to date

### API calls failing
- Check network connectivity
- Verify API endpoint URL is correct
- Check CloudWatch logs for Lambda errors

### Mock Device Kit issues
- Ensure Mock Device Kit is running
- Check that the app has necessary permissions
- Restart the simulator if connection fails

## References

- [Meta Wearables Device Access Toolkit](https://developers.meta.com/wearables/)
- [Meta Ray-Ban Glasses Developer Guide](https://developers.meta.com/horizon/documentation/wearables/)
- [SiteSentinel API Documentation](../README.md)
