package com.metalflow.app;

import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        super.onResume();

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
    }
}