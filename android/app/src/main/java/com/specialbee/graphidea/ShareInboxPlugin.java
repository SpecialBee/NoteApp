package com.specialbee.graphidea;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives text shared from other apps (Android share sheet → GRAPHIDEA).
 *
 * The share can arrive before the web layer has booted (cold start) or while it's running
 * (onNewIntent), so it's parked here and the web side pulls it with getPending() once its notes
 * are loaded. "shareReceived" only tells an already-running page that something is waiting.
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {
    private String pendingText;
    private String pendingSubject;

    @Override
    public void load() {
        capture(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (capture(intent)) notifyListeners("shareReceived", new JSObject());
    }

    private boolean capture(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return false;
        pendingText = text;
        pendingSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        // consume it so a later activity recreation (rotation, theme change) doesn't re-deliver
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingText != null) {
            ret.put("text", pendingText);
            if (pendingSubject != null) ret.put("subject", pendingSubject);
        }
        pendingText = null;
        pendingSubject = null;
        call.resolve(ret);
    }
}
