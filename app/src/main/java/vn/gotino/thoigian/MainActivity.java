package vn.gotino.thoigian;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

/** Offline Android shell for the GOTINO time planning web app. No network permission. */
public class MainActivity extends Activity {
    private static final String BASE = "https://appassets.androidplatform.net/assets/";
    private static final int REQ_IMPORT = 6201;
    private static final int REQ_EXPORT = 6202;
    private static final int REQ_EVENT_PERMISSION = 6203;
    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String exportContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 246, 242));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        webView.addJavascriptInterface(new AndroidAppBridge(), "AndroidApp");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!"https".equals(url.getScheme()) || !"appassets.androidplatform.net".equals(url.getHost()) ||
                        (url.getPort() != -1 && url.getPort() != 443)) {
                    return null;
                }
                String path = url.getPath();
                if (path == null || !path.startsWith("/assets/")) return notFound();
                String file = path.substring("/assets/".length());
                if (file.isEmpty() || file.contains("..") || file.startsWith("/") || file.contains("\\")) {
                    return notFound();
                }
                try {
                    InputStream input = getAssets().open(file);
                    String mime = mimeFor(file);
                    HashMap<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, input);
                } catch (IOException error) {
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith(BASE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith(BASE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,
                        new String[]{"application/json", "text/plain", "application/octet-stream"});
                try {
                    startActivityForResult(intent, REQ_IMPORT);
                } catch (ActivityNotFoundException err) {
                    fileChooserCallback.onReceiveValue(null);
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "Không mở được trình chọn tệp", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        webView.loadUrl(BASE + "index.html" + (getIntent().getBooleanExtra(EventReminderReceiver.OPEN_EVENTS, false) ? "#events" : ""));
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshEventPermissions();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (webView != null && intent.getBooleanExtra(EventReminderReceiver.OPEN_EVENTS, false)) {
            webView.evaluateJavascript("location.hash = 'events'", null);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_EVENT_PERMISSION) refreshEventPermissions();
    }

    private void refreshEventPermissions() {
        EventReminderReceiver.refresh(this);
        if (webView != null) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('eventpermissionchange'))", null);
        }
    }

    private void openEventNotificationSettings() {
        EventReminderReceiver.ensureChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            boolean asked = getPreferences(MODE_PRIVATE).getBoolean("askedEventNotifications", false);
            if (!asked || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                getPreferences(MODE_PRIVATE).edit().putBoolean("askedEventNotifications", true).apply();
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_EVENT_PERMISSION);
                return;
            }
        }
        Intent settings;
        if (Build.VERSION.SDK_INT >= 26) {
            settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            settings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        }
        startActivity(settings);
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                new HashMap<>(), new ByteArrayInputStream("Not Found".getBytes(StandardCharsets.UTF_8)));
    }

    private final class AndroidAppBridge {
        // Nguồn lưu ổn định độc lập với cấu hình DOM Storage của Android WebView.
        @JavascriptInterface
        public String loadData() {
            return getSharedPreferences("timeplanner_data", MODE_PRIVATE).getString("planner_json", "");
        }

        @JavascriptInterface
        public boolean saveData(String json) {
            if (json == null || json.length() > 8_000_000) return false;
            boolean saved = getSharedPreferences("timeplanner_data", MODE_PRIVATE)
                    .edit().putString("planner_json", json).commit();
            if (saved) runOnUiThread(() -> EventReminderReceiver.refresh(MainActivity.this));
            return saved;
        }

        @JavascriptInterface
        public String eventNotificationStatus() {
            return EventReminderReceiver.canNotify(MainActivity.this) ? "enabled" : "disabled";
        }

        @JavascriptInterface
        public void enableEventNotifications() {
            runOnUiThread(MainActivity.this::openEventNotificationSettings);
        }

        @JavascriptInterface
        public void saveTextFile(String content, String filename, String mime) {
            runOnUiThread(() -> openExportPicker(content, filename, mime));
        }
    }

    private void openExportPicker(String content, String filename, String mime) {
        if (exportContent != null) {
            Toast.makeText(this, "Hãy hoàn tất lần xuất tệp trước", Toast.LENGTH_SHORT).show();
            return;
        }
        if (content == null || content.length() > 12_000_000) {
            Toast.makeText(this, "Tệp xuất quá lớn", Toast.LENGTH_SHORT).show();
            return;
        }
        exportContent = content;
        String safeName = filename == null ? "sao-luu.json" : filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String type = "text/calendar".equals(mime) ? "text/calendar"
                : (mime != null && mime.startsWith("text/csv")) ? "text/csv" : "application/json";
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_TITLE, safeName);
        try {
            startActivityForResult(intent, REQ_EXPORT);
        } catch (ActivityNotFoundException err) {
            exportContent = null;
            Toast.makeText(this, "Không mở được trình lưu tệp", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_IMPORT) {
            if (fileChooserCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
                fileChooserCallback.onReceiveValue(result);
                fileChooserCallback = null;
            }
        } else if (requestCode == REQ_EXPORT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && exportContent != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (out == null) throw new IOException("Null output stream");
                    out.write(exportContent.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "Đã lưu tệp thành công", Toast.LENGTH_LONG).show();
                } catch (IOException err) {
                    Toast.makeText(this, "Lỗi lưu tệp: " + err.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            exportContent = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("(function(){if(document.getElementById('modal-backdrop')){" +
                "var close=document.querySelector('[data-action=close-modal]');if(close)close.click();return true;}" +
                "if(document.getElementById('sidebar').classList.contains('open')){" +
                "document.getElementById('scrim').click();return true;}" +
                "if(location.hash && location.hash!=='#dashboard'){" +
                "var home=document.querySelector('[data-page=dashboard]');if(home)home.click();return true;}" +
                "return false;})()", result -> {
            if (!"true".equals(result)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
