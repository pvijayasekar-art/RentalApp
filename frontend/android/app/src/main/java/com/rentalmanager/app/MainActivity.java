package com.rentalmanager.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.capacitorjs.plugins.camera.CameraPlugin.class);
        registerPlugin(com.capacitorjs.plugins.filesystem.FilesystemPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Configure WebView for CORS and JavaScript
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setAllowFileAccessFromFileURLs(true);
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject JavaScript to bypass CORS for XMLHttpRequest
                view.evaluateJavascript(
                    "window._xhrOpen = XMLHttpRequest.prototype.open; " +
                    "XMLHttpRequest.prototype.open = function(method, url, async, user, password) { " +
                    "  if (url.includes('10.131.144.64') || url.includes('192.168.') || url.includes('172.') || url.includes('10.0.2.2')) { " +
                    "    this.setRequestHeader('Origin', 'http://localhost'); " +
                    "  } " +
                    "  return window._xhrOpen.apply(this, arguments); " +
                    "};", null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
    }
}
