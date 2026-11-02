package com.meta.sitesentinel

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * SiteSentinel Glasses Integration
 *
 * This is a minimal skeleton for streaming frames from Meta Ray-Ban glasses
 * to the SiteSentinel inspection API.
 *
 * To use with real glasses:
 * 1. Add Meta Wearables Device Access Toolkit dependency
 * 2. Initialize WearableDeviceManager
 * 3. Connect to glasses and subscribe to camera stream
 * 4. Process frames in onCameraFrame callback
 *
 * For testing:
 * - Use Meta Mock Device Kit to simulate glasses camera stream
 * - Or use phone camera via CameraX API
 */
class MainActivity : AppCompatActivity() {

    private val TAG = "SiteSentinel"
    private val API_URL = "https://your-api-url.lambda-url.us-east-1.on.aws"
    
    private val httpClient = OkHttpClient()
    private var frameScheduler: ScheduledExecutorService? = null

    companion object {
        private const val CAMERA_PERMISSION_REQUEST = 100
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "SiteSentinel Glasses App Started")
        
        // Check camera permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                CAMERA_PERMISSION_REQUEST
            )
        } else {
            initializeGlassesConnection()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                initializeGlassesConnection()
            } else {
                Toast.makeText(this, "Camera permission required", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    /**
     * Initialize connection to Meta Ray-Ban glasses
     *
     * Production implementation would:
     * 1. Initialize WearableDeviceManager from Meta Wearables SDK
     * 2. Scan for paired glasses
     * 3. Connect to device
     * 4. Subscribe to camera stream with desired resolution/frame rate
     * 5. Handle connection state changes and errors
     *
     * Example (pseudo-code):
     * ```
     * val deviceManager = WearableDeviceManager.getInstance(this)
     * deviceManager.scanForDevices { device ->
     *     if (device.type == DeviceType.RAY_BAN_GLASSES) {
     *         deviceManager.connect(device) { connected ->
     *             if (connected) {
     *                 subscribeToCameraStream(device)
     *             }
     *         }
     *     }
     * }
     * ```
     */
    private fun initializeGlassesConnection() {
        Log.d(TAG, "Initializing glasses connection...")
        
        // TODO: Replace with actual Meta Wearables SDK initialization
        // For now, simulate periodic frame capture for testing
        
        Toast.makeText(this, "Glasses connection initialized (mock mode)", Toast.LENGTH_SHORT).show()
        
        // Start mock frame capture every 10 seconds
        startMockFrameCapture()
    }

    /**
     * Subscribe to camera stream from glasses
     *
     * Production would use Meta Wearables SDK:
     * ```
     * device.subscribeToCameraStream(
     *     resolution = CameraResolution.HD_720P,
     *     frameRate = 10
     * ) { frame ->
     *     onCameraFrame(frame.imageData)
     * }
     * ```
     */
    private fun startMockFrameCapture() {
        frameScheduler = Executors.newSingleThreadScheduledExecutor()
        frameScheduler?.scheduleAtFixedRate({
            // In production, this would be called by the glasses camera callback
            // For now, generate a mock frame
            val mockFrame = generateMockFrame()
            onCameraFrame(mockFrame)
        }, 5, 10, TimeUnit.SECONDS)
    }

    /**
     * Handle incoming camera frame from glasses
     */
    private fun onCameraFrame(frameData: ByteArray) {
        Log.d(TAG, "Received camera frame: ${frameData.size} bytes")
        
        // Convert frame to base64
        val base64Frame = Base64.encodeToString(frameData, Base64.NO_WRAP)
        
        // Send to inspection API
        inspectFrame(base64Frame)
    }

    /**
     * Send frame to SiteSentinel inspection API
     */
    private fun inspectFrame(base64Image: String) {
        val json = JSONObject().apply {
            put("image", base64Image)
            put("rulePackId", "construction")
            put("zone", "site-main")
            put("siteId", "demo-site")
            put("returnOverlay", true)
        }

        val requestBody = json.toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$API_URL/inspect")
            .post(requestBody)
            .build()

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Inspection API call failed", e)
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Inspection failed: ${e.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                
                if (!response.isSuccessful) {
                    Log.e(TAG, "Inspection API error: $responseBody")
                    return
                }

                try {
                    val result = JSONObject(responseBody ?: "")
                    val issues = result.getJSONArray("issues")
                    
                    Log.d(TAG, "Detected ${issues.length()} issues")
                    
                    if (issues.length() > 0) {
                        val topIssue = issues.getJSONObject(0)
                        val title = topIssue.getString("title")
                        val riskBand = topIssue.getString("riskBand")
                        
                        runOnUiThread {
                            Toast.makeText(
                                this@MainActivity,
                                "⚠️ $riskBand risk: $title",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse inspection response", e)
                }
            }
        })
    }

    /**
     * Generate mock frame for testing
     * In production, this would come from the glasses camera
     */
    private fun generateMockFrame(): ByteArray {
        // Return a minimal 1x1 pixel JPEG for testing
        // In production, this would be actual camera frame data
        return ByteArrayOutputStream().apply {
            // Minimal JPEG header + single pixel
            write(byteArrayOf(
                0xFF.toByte(), 0xD8.toByte(), // SOI
                0xFF.toByte(), 0xE0.toByte(), // APP0
                0x00.toByte(), 0x10.toByte(), // Length
                0x4A.toByte(), 0x46.toByte(), 0x49.toByte(), 0x46.toByte(), 0x00.toByte(), // JFIF
                0x01.toByte(), 0x01.toByte(), // Version
                0x00.toByte(), // Aspect ratio
                0x00.toByte(), 0x01.toByte(), 0x00.toByte(), 0x01.toByte(), // Thumbnail
                0x00.toByte(), 0x00.toByte(),
                0xFF.toByte(), 0xD9.toByte() // EOI
            ))
        }.toByteArray()
    }

    override fun onDestroy() {
        super.onDestroy()
        frameScheduler?.shutdown()
        // TODO: Disconnect from glasses in production
    }
}
