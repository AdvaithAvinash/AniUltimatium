package com.aniultimatium.tv;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Android TV / Fire TV / tablet wrapper for the Aniultimatium web app.
 * The whole app (the same files as the Samsung .wgt) is bundled in assets/ and runs in a WebView. What the wrapper adds:
 *  - the TV launcher entry (leanback banner), a D-pad friendly full-screen window, Back and Menu handling;
 *  - popup blocking: window.open() from the movie players and ad redirects of the top page are stopped, and counted so the app can tag the source;
 *  - file:// pages may call any http(s) host (like the Samsung widget), so IPTV providers without CORS work directly.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "file:///android_asset/index.html";
    private WebView web;
    private FrameLayout root;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private WebChromeClient chrome;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0B12"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);   // http IPTV streams from the bundled page
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);                      // no CORS for the bundled page: playlists, guides and streams load directly
        s.setSupportMultipleWindows(true);                                // so popups reach onCreateWindow and can be refused
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " AniUltimatiumTV/" + versionName() + " (AndroidTV)");

        web.addJavascriptInterface(new Bridge(), "AniNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;              // pages inside the movie players may navigate freely
                String u = request.getUrl().toString();
                if (u.startsWith("file:///android_asset/")) return false;
                notifyPopup("redirect");                                  // the top page is never allowed to leave the app (ad redirects)
                return true;
            }
        });
        chrome = new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                notifyPopup("popup");                                     // window.open() / target=_blank from an embedded player: refused
                return false;
            }
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {   // element.requestFullscreen()
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view; customCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }
            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                root.removeView(customView); customView = null;
                web.setVisibility(View.VISIBLE);
                if (customCallback != null) customCallback.onCustomViewHidden();
                customCallback = null;
                web.requestFocus();
            }
            @Override
            public Bitmap getDefaultVideoPoster() { return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888); }
            @Override
            public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        };
        web.setWebChromeClient(chrome);

        hideSystemBars();
        web.requestFocus();
        if (savedInstanceState != null) web.restoreState(savedInstanceState); else web.loadUrl(START_URL);
    }

    private String versionName() {
        try { PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0); return p.versionName; } catch (Exception e) { return "1"; }
    }

    private void js(final String code) {
        if (web != null) web.post(new Runnable() { public void run() { web.evaluateJavascript(code, null); } });
    }

    private void notifyPopup(String kind) {
        js("window.EA_popup&&window.EA_popup('" + kind + "')");
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    /** Back goes to the app's own handler (it knows about menus, players and tabs); the app calls AniNative.exit() when there is nothing left to close. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (customView != null) {
                if (e.getAction() == KeyEvent.ACTION_UP && web != null) chrome.onHideCustomView();
                return true;
            }
            if (e.getAction() == KeyEvent.ACTION_UP)
                js("(function(){var e=document.createEvent('Event');e.initEvent('tizenhwkey',true,true);e.keyName='back';document.dispatchEvent(e);})()");
            return true;
        }
        int mapped = mapKey(e.getKeyCode());
        if (mapped != 0) {                                                // keys WebView does not hand to the page: sent as the codes the app already uses
            if (e.getAction() == KeyEvent.ACTION_DOWN) js("window.EA_key&&window.EA_key(" + mapped + ")");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    /** Android key code -> the key code the web app knows (Samsung remote codes: it was written for those first). 0 = let WebView handle it. */
    private static int mapKey(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return 10252;
            case KeyEvent.KEYCODE_MEDIA_PLAY: return 415;
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return 19;
            case KeyEvent.KEYCODE_MEDIA_STOP: return 413;
            case KeyEvent.KEYCODE_MEDIA_REWIND: return 412;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: return 417;
            case KeyEvent.KEYCODE_MENU: case KeyEvent.KEYCODE_PROG_RED: return 403;       // player settings / remove card
            case KeyEvent.KEYCODE_PROG_GREEN: return 404;
            case KeyEvent.KEYCODE_PROG_YELLOW: return 405;
            case KeyEvent.KEYCODE_PROG_BLUE: return 406;
            case KeyEvent.KEYCODE_INFO: return 457;
            case KeyEvent.KEYCODE_CHANNEL_UP: case KeyEvent.KEYCODE_PAGE_UP: return 427;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: return 428;
            default: return 0;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.requestFocus(); } }

    @Override
    protected void onDestroy() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }

    /** What the web app can ask of the shell. */
    private class Bridge {
        @JavascriptInterface public String version() { return versionName(); }
        @JavascriptInterface public int sdk() { return Build.VERSION.SDK_INT; }
        @JavascriptInterface public void exit() { runOnUiThread(new Runnable() { public void run() { finish(); } }); }
    }
}
