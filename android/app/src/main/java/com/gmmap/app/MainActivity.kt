package com.gmmap.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.PictureInPictureParams
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Rational
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.Locale

/**
 * Native shell around the map UI.
 *
 * The UI itself is the web app at the repo root, bundled into the APK and served to a WebView
 * from a private https origin. This class supplies what a web page can't do well on its own:
 * location permission, spoken directions, an always-on screen, edge-to-edge insets, and a
 * floating picture-in-picture mini-map while navigating.
 */
class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private lateinit var web: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var navigating = false
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    @Volatile
    private var insetsJson = """{"top":0,"right":0,"bottom":0,"left":0}"""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // A driving map should never dim or lock while it is on screen.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        web = WebView(this)
        web.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        web.setBackgroundColor(0xFF0B0C0D.toInt())
        web.overScrollMode = WebView.OVER_SCROLL_NEVER
        setContentView(web)

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WwwPathHandler(this))
            .build()

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            // Only the bundled app may run inside the WebView; any other link opens in the browser.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == APP_HOST) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                } catch (_: ActivityNotFoundException) {
                    // no browser installed; nothing to do
                }
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    requestLocationPermission()
                }
            }
        }

        web.addJavascriptInterface(Bridge(), "GmNative")

        // Report system-bar sizes (in CSS pixels) so the HUD can keep clear of them.
        ViewCompat.setOnApplyWindowInsetsListener(web) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            val density = resources.displayMetrics.density
            insetsJson = JSONObject()
                .put("top", (bars.top / density).toDouble())
                .put("right", (bars.right / density).toDouble())
                .put("bottom", (bars.bottom / density).toDouble())
                .put("left", (bars.left / density).toDouble())
                .toString()
            emit("insets", JSONObject(insetsJson))
            insets
        }

        tts = TextToSpeech(this, this)

        // GPS is always on: ask for location as soon as the app opens.
        if (!hasLocationPermission()) requestLocationPermission()

        if (savedInstanceState == null) {
            web.loadUrl("https://$APP_HOST/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }
    }

    // ---- location permission ---------------------------------------------------------------

    private fun hasLocationPermission(): Boolean =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun requestLocationPermission() {
        requestPermissions(
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            REQUEST_LOCATION,
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_LOCATION) return
        val granted = hasLocationPermission()
        val origin = pendingGeoOrigin
        val callback = pendingGeoCallback
        if (origin != null && callback != null) callback.invoke(origin, granted, false)
        pendingGeoCallback = null
        pendingGeoOrigin = null
        emit("permission", JSONObject().put("location", granted))
    }

    // ---- speech ----------------------------------------------------------------------------

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        tts?.let {
            it.setLanguage(Locale.getDefault())
            it.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            ttsReady = true
        }
    }

    // ---- picture-in-picture mini-map -------------------------------------------------------

    private fun pipParams(): PictureInPictureParams {
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(3, 4))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(navigating)
        return builder.build()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Leaving the app mid-route (Home, or switching apps) shrinks it to a floating mini-map.
        if (navigating && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            try {
                enterPictureInPictureMode(pipParams())
            } catch (_: IllegalStateException) {
                // PiP disabled for this app in system settings
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        emit("pip", JSONObject().put("active", isInPictureInPictureMode))
    }

    // ---- lifecycle -------------------------------------------------------------------------

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        // Keep the page (and its GPS watch) running while it is visible as a mini-map.
        if (!isInPictureInPictureMode) web.onPause()
        super.onPause()
    }

    override fun onStop() {
        super.onStop()
        // Once the mini-map is dismissed there is nothing left on screen to drive.
        web.onPause()
    }

    override fun onStart() {
        super.onStart()
        web.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        web.destroy()
        super.onDestroy()
    }

    // ---- bridge ----------------------------------------------------------------------------

    /** Sends `{type, ...detail}` to the page as a "gm-native" event (see src/platform.js). */
    private fun emit(type: String, detail: JSONObject) {
        detail.put("type", type)
        val script = "window.dispatchEvent(new CustomEvent('gm-native',{detail:$detail}));"
        web.post { web.evaluateJavascript(script, null) }
    }

    /** Methods callable from the page as `window.GmNative.*`. They run on a WebView thread. */
    inner class Bridge {
        @JavascriptInterface
        fun speak(text: String) {
            runOnUiThread {
                if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "gm-nav")
            }
        }

        @JavascriptInterface
        fun stopSpeaking() {
            runOnUiThread { tts?.stop() }
        }

        @Suppress("UNUSED_PARAMETER")
        @JavascriptInterface
        fun setKeepAwake(on: Boolean) {
            // The screen is kept on for the whole session (see onCreate); nothing to toggle.
        }

        @JavascriptInterface
        fun setLightBars(light: Boolean) {
            runOnUiThread {
                val controller = WindowCompat.getInsetsController(window, web)
                controller.isAppearanceLightStatusBars = light
                controller.isAppearanceLightNavigationBars = light
            }
        }

        @JavascriptInterface
        fun setNavigating(on: Boolean) {
            runOnUiThread {
                navigating = on
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        setPictureInPictureParams(pipParams())
                    } catch (_: IllegalStateException) {
                        // PiP unsupported on this device
                    }
                }
            }
        }

        @JavascriptInterface
        fun getInsets(): String = insetsJson
    }

    /** Serves the bundled web app from assets/www with correct MIME types (including .mjs). */
    private class WwwPathHandler(private val activity: Activity) : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val clean = path.substringBefore('?').substringBefore('#').ifEmpty { "index.html" }
            if (clean.contains("..")) return null
            return try {
                val stream = activity.assets.open("www/$clean")
                val mime = MIME[clean.substringAfterLast('.', "").lowercase(Locale.ROOT)] ?: "application/octet-stream"
                val encoding = if (mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("xml")) "utf-8" else null
                WebResourceResponse(mime, encoding, stream)
            } catch (_: IOException) {
                WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
        }
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val REQUEST_LOCATION = 41

        private val MIME = mapOf(
            "html" to "text/html",
            "js" to "text/javascript",
            "mjs" to "text/javascript",
            "css" to "text/css",
            "json" to "application/json",
            "webmanifest" to "application/manifest+json",
            "svg" to "image/svg+xml",
            "png" to "image/png",
            "woff2" to "font/woff2",
        )
    }
}
