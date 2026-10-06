package com.specialbee.graphidea;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // local plugins have to be registered before the bridge starts up in super.onCreate
        registerPlugin(ShareInboxPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
