package com.dreamering.module

import com.dreamering.native_component.notification.AppIconsNotificationLayoutManager
import com.dreamering.module.backgroundsetting.AndroidBackgroundSettingsModule
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.dreamering.native_component.ecg.YCRingECGViewManager
import com.dreamering.native_component.ecg.YCRingECGReportChartViewManager

class NativeModulePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            RTCNativeModule(reactContext),
            RTCNativeRingModule(reactContext),
            RTCNativeYCRingModule(reactContext),
            AppUpdateNativeModule(reactContext),
            NativeMusicPlayingListenerModule(reactContext),
            AndroidBackgroundSettingsModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            YCRingECGViewManager(reactContext),
            YCRingECGReportChartViewManager(reactContext),
            AppIconsNotificationLayoutManager()
        )
    }
}

