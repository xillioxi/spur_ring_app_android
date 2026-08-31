package com.dreamering.module;


import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.Nullable;

import com.dreamering.BuildConfig;
import com.dreamering.R;
import com.eiot.ringsdk.ServiceSdkCommandV2;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.umeng.commonsdk.UMConfigure;
import com.yucheng.ycbtsdk.YCBTClient;
import com.yucheng.ycbtsdk.bean.ScanDeviceBean;
import com.yucheng.ycbtsdk.response.BleConnectResponse;
import com.yucheng.ycbtsdk.response.BleScanResponse;


import java.util.HashMap;
import java.util.Map;

public class RTCNativeModule extends ReactContextBaseJavaModule  {
    private static final String TAG = "RTCNativeModule";
    public RTCNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }


    @Nullable
    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("env", BuildConfig.BUILD_TYPE);
        return constants;
    }

    @Override
    public String getName() {
        return "NativeModule";
    }

    /**
     * 回到系统桌面（等同于按下 Home 进入启动器），用于教程页引导用户去系统设置。
     */
    @ReactMethod
    public void goToHomeScreen() {
        Activity activity = getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_MAIN);
                intent.addCategory(Intent.CATEGORY_HOME);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            });
        }
    }

    @ReactMethod
    public void exitApp() {
        // 从 JS/后台定时器线程调用时，需在主线程结束任务栈再杀进程，否则部分机型上仅 killProcess 不生效
        Activity activity = getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                activity.finishAffinity();
                android.os.Process.killProcess(android.os.Process.myPid());
            });
        } else {
            android.os.Process.killProcess(android.os.Process.myPid());
        }
    }

    /**
     * 重新启动应用（用于系统语言变更后重新初始化 i18n 等资源）。
     */
    @ReactMethod
    public void restartApp() {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            return;
        }
        activity.runOnUiThread(() -> {
            Intent launchIntent = activity.getPackageManager()
                    .getLaunchIntentForPackage(activity.getPackageName());
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                activity.startActivity(launchIntent);
            }
            activity.finishAffinity();
            android.os.Process.killProcess(android.os.Process.myPid());
        });
    }



    @ReactMethod
    public void setupVendor(Promise promise) {
        Log.d(TAG, "原生setupVendor， 所有三方库初始化需走这这个函数");
        // 戒指sdk
        Application application = getReactApplicationContext().getCurrentActivity().getApplication();
        Log.d(TAG,application.toString());
        // 厂商遇到的引用bug  实际参数有9个  但是api引用才8ge   多一个 btuuid  厂商沟通之后 传空即可
        String btuuid = "";
        // WARNING:  初始化 Dreame Ring 字段不可以改变，不然就会延强的戒指数据就会无法重连上
        ServiceSdkCommandV2.INSTANCE.init(application,1,BuildConfig.VERSION_NAME,"Dreame Ring", BuildConfig.APPLICATION_ID,  "CN", "ZH",btuuid, true);
        // 友盟
        UMConfigure.init(getReactApplicationContext(),"694c06fa9a7f376488101573", "mall", UMConfigure.DEVICE_TYPE_PHONE, "");


        YCBTClient.initClient(getReactApplicationContext(), true,true);

        promise.resolve(null);
    }
}