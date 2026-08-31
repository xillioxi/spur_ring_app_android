package com.dreamering.module;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Set;

import java.lang.reflect.Method;

import androidx.annotation.NonNull;

import com.dreamering.util.RingBrand;
import com.dreamering.util.RingDataUpdateType;
import com.eiot.aizo.sdk.callback.AizoDeviceConnectCallback;
import com.eiot.ringsdk.ServiceSdkCommandV2;
import com.eiot.ringsdk.battery.PowerState;
import com.eiot.ringsdk.be.BtHelper;
import com.eiot.ringsdk.be.DeviceManager;
import com.eiot.ringsdk.bean.AlarmModel;
import com.eiot.ringsdk.bean.DeviceSmartTouchMode;
import com.eiot.ringsdk.bean.EmotionModel;
import com.eiot.ringsdk.bean.ExBluetoothDevice;
import com.eiot.ringsdk.bean.FirmwareParams;
import com.eiot.ringsdk.bean.HealthDataBean;
import com.eiot.ringsdk.bean.HealthRecord;
import com.eiot.ringsdk.bean.SportRecord;
import com.eiot.ringsdk.bean.SportStatus;
import com.eiot.ringsdk.bean.SleepRecord;
import com.eiot.ringsdk.bean.SleepStage;
import com.eiot.ringsdk.bean.VibrateToggleModel;
import com.eiot.ringsdk.bean.VibrateWainingModel;
import com.eiot.be.algorithm.HealthScore;
import com.eiot.be.algorithm.SleepScore;
import com.eiot.be.algorithm.ActivityScore;
import com.eiot.be.algorithm.ReadinessScore;
import com.eiot.ringsdk.callback.BCallback;
import com.eiot.ringsdk.callback.DeviceOtaResultCallback;
import com.eiot.ringsdk.callback.DeviceSmartTouchModeCallback;
import com.eiot.ringsdk.callback.EmotionDataCallback;
import com.eiot.ringsdk.callback.HealthDataCallback;
import com.eiot.ringsdk.callback.ICallback;
import com.eiot.ringsdk.callback.OnBluetoothSearchListener;
import com.eiot.ringsdk.callback.PowerStateCallback;
import com.eiot.ringsdk.callback.StepDataCallback;
import com.eiot.ringsdk.callback.VibrateAlarmsCallback;
import com.eiot.ringsdk.callback.VibrateToggleCallback;
import com.eiot.ringsdk.callback.VibrateWainingDataCallback;
import com.eiot.ringsdk.callback.HealthScoreCallback;
import com.eiot.ringsdk.callback.SleepDataCallback;
import com.eiot.ringsdk.callback.SportStatusCallback;
import com.eiot.ringsdk.callback.SportRecordCallback;
import com.eiot.ringsdk.measure.MeasureResult;
import com.eiot.ringsdk.measure.MeasureResultCallback;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.dreamering.native_component.notification.NotificationSelection;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

import android.content.res.Resources;
import java.lang.reflect.Field;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import java.util.List;
import android.os.Handler;
import android.os.Looper;
import com.alibaba.fastjson.*;
import com.dreamering.util.CallManager;
import com.dreamering.util.BluetoothBondManager;

public class RTCNativeRingModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private static final String TAG = "RTCNativeRingModule";
    private int listenerCount = 0;
    private String currentMeasureType = null;

    private volatile boolean otaInProgress = false;
    private volatile boolean otaFinished = false;

    private final AizoDeviceConnectCallback connectCallback = new AizoDeviceConnectCallback() {
        @Override
        public void connect() {
            BluetoothBondManager bluetoothBondManager = new BluetoothBondManager(getReactApplicationContext());
            bluetoothBondManager.ensureBondAuthorized(getDeviceMac(),
                    new BluetoothBondManager.BondAuthorizationCallback() {
                        @Override
                        public void onAuthorized() {
                            notifyBoundDeviceAfterAuthorized();
                        }

                        @Override
                        public void onError(String message) {
                            notifyBoundDeviceAfterAuthorized();
                        }
                    });
        }

        @Override
        public void disconnect() {
            sendEvent("ringStatusUpdated", -7);
        }

        @Override
        public void connectError(Throwable throwable, int state) {
            sendEvent("ringStatusUpdated", state);
        }
    };

    private void notifyBoundDeviceAfterAuthorized() {
        sendEvent("ringStatusUpdated", -2);
        try {
            ServiceSdkCommandV2.INSTANCE.notifyBoundDevice(
                    "DREAME RING",
                    getDeviceMac(),
                    new BCallback() {
                        @Override
                        public void result(boolean b) {
                            Log.d(TAG, "notifyBoundDevice: " + b);
                            if (b) {
                                ServiceSdkCommandV2.INSTANCE.requestConnectionPriority();
                            }
                        }
                    }

            );
        } catch (Throwable ignored) {
        }
    }

    public RTCNativeRingModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public void onHostDestroy() {
        Log.d(TAG, "onHostDestroy");

        // 参考 iOS appWillTerminate 实现：
        // 1. 停止定时器
        // 2. 停止运动（不等待回调，因为 app 正在终止）
        // 3. 停止测量（不等待回调，因为 app 正在终止）

        // 停止运动实时数据查询计时器
        stopSportDataTimer();

        // 停止运动（如果有正在进行的运动）
        if (currentSportId != null && currentSportType != null) {
            try {
                Log.d(TAG, "Stopping sport on app termination: sportId=" + currentSportId + ", sportType="
                        + currentSportType);
                // 不等待回调，因为 app 正在终止（参考 iOS 实现）
                ServiceSdkCommandV2.INSTANCE.sportStop(
                        currentSportType,
                        currentSportId,
                        new ICallback() {
                            @Override
                            public void result(int r) {
                                // 回调可能无法执行，因为 app 正在终止
                                Log.d(TAG, "Sport stopped on app termination, result: " + r);
                            }
                        },
                        // SportRecordCallback - 不处理记录，因为 app 正在终止
                        null);
                // 清空状态
                currentSportId = null;
                currentSportType = null;
            } catch (Exception e) {
                Log.e(TAG, "Failed to stop sport on app termination: " + e.getMessage());
                // 即使失败也清空状态
                currentSportId = null;
                currentSportType = null;
            }
        }

        // 停止测量（如果有正在进行的测量）
        if (currentMeasureType != null) {
            try {
                Log.d(TAG, "Stopping measurement on app termination: type=" + currentMeasureType);

                // 使用 instantMeasurement(type, 2, ...) 来停止测量（参考 stopMeasurement 实现）
                // 不等待回调，因为 app 正在终止（参考 iOS 实现）
                ServiceSdkCommandV2.INSTANCE.instantMeasurement(
                        getMeasureType(currentMeasureType),
                        2, // 2 表示停止测量
                        new MeasureResultCallback() {
                            @Override
                            public void measureResult(MeasureResult bean) {
                                // 回调可能无法执行，因为 app 正在终止
                                Log.d(TAG, "Measurement stopped on app termination");
                            }
                        });
                // 清空状态
                currentMeasureType = null;
            } catch (Exception e) {
                Log.e(TAG, "Failed to stop measurement on app termination: " + e.getMessage());
                // 即使失败也清空状态
                currentMeasureType = null;
            }
        }
    }

    @Override
    public void onHostPause() {

    }

    @Override
    public void onHostResume() {

    }

    @NonNull
    @Override
    public String getName() {
        return "NativeRingModule";
    }

    @ReactMethod
    public void addListener(String eventName) {
        if (listenerCount == 0) {
            setup();
        }
        listenerCount += 1;
    }

    @ReactMethod
    public void removeListeners(int count) {
        listenerCount -= count;
        if (listenerCount < 0) {
            listenerCount = 0;
        }
    }

    private void setup() {
        configureObservers();
    }

    private void configureObservers() {
        ServiceSdkCommandV2.INSTANCE.registerPowerStateListener(new PowerStateCallback() {
            @Override
            public void PowerState(@NonNull PowerState powerState) {
                WritableMap params = Arguments.createMap();
                params.putInt("batteryLevel", powerState.getElectricity());
                params.putInt("chargingState", powerState.getWorkingMode());
                sendEvent("chargeHandler", params);
            }
        });

        ServiceSdkCommandV2.INSTANCE.addDeviceConfigCallback(deviceConfig -> {
            Log.d("device config callback", deviceConfig.toString());
        });
    }

    @ReactMethod
    void disconnect() {
        if (DeviceManager.INSTANCE.isConnect()) {
            DeviceManager.INSTANCE.disconnect();
        }
    }

    @ReactMethod
    void queryPowerStatus() {
        if (!isConnected()) {
            return;
        }
        ServiceSdkCommandV2.INSTANCE.getInstantPowerState();
    }

    @ReactMethod
    public void queryEmotionData(String dateString, Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "EMOTION Device not connected");
            return;
        }

        long startOfDay;
        if (dateString == null || dateString.isEmpty()) {
            long now = System.currentTimeMillis();
            startOfDay = now - (now % TimeUnit.DAYS.toMillis(1));
        } else {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                Date d = sdf.parse(dateString);
                if (d == null) {
                    promise.reject("ERROR", "EMOTION Invalid date string format. Expected: yyyy-MM-dd");
                    return;
                }
                startOfDay = d.getTime();
            } catch (java.text.ParseException e) {
                promise.reject("ERROR", "EMOTION Invalid date string format. Expected: yyyy-MM-dd", e);
                return;
            }
        }
        Log.d(TAG, "EMOTION 查询日期" + dateString);

        promise.resolve(null);
        // 会回调多次
        ServiceSdkCommandV2.INSTANCE.getEmotion(startOfDay, 0, new EmotionDataCallback() {
            @Override
            public void onEmotions(@NonNull List<EmotionModel> list) {
                WritableArray arr = Arguments.createArray();
                if (list != null && !list.isEmpty()) {
                    for (EmotionModel model : list) {
                        WritableMap map = Arguments.createMap();
                        map.putLong("timestamp", model.getDatetime());
                        map.putInt("emotion", model.getEmotionLevel());
                        map.putInt("stress", model.getStress());
                        map.putDouble("valenceAdjust", model.getValence());
                        map.putDouble("rpe", model.getRpe());
                        arr.pushMap(map);
                    }
                    WritableMap body = Arguments.createMap();
                    body.putString("type", RingDataUpdateType.EMOTION.toString());
                    body.putArray("data", arr);
                    sendEvent("deviceDataUpdate", body);
                } else {
                    Log.d(TAG, "EMOTION 不存在" + dateString);
                }

            }
        });
    }

    @ReactMethod
    public void queryHealthScore(String dateString, Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected");
            return;
        }

        long startOfDay;
        if (dateString == null || dateString.isEmpty()) {
            long now = System.currentTimeMillis();
            startOfDay = now - (now % TimeUnit.DAYS.toMillis(1));
        } else {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
                Date d = sdf.parse(dateString);
                if (d == null) {
                    promise.reject("ERROR", "Invalid date string format. Expected: yyyy-MM-dd");
                    return;
                }
                startOfDay = d.getTime();
            } catch (java.text.ParseException e) {
                promise.reject("ERROR", "Invalid date string format. Expected: yyyy-MM-dd", e);
                return;
            }
        }

        final ArrayList<SleepRecord> tempSleepRecords = new ArrayList<>();
        final ArrayList<HealthRecord> tempHealthRecords = new ArrayList<>();
        final ArrayList<WritableMap> healthEventBuffer = new ArrayList<>();

        // 仅在健康数据 onFinish 后调用（睡眠回调内再发起健康查询，完全串行）
        final Runnable tryRunCalcu = () -> {
            if (tempSleepRecords.isEmpty() || tempHealthRecords.isEmpty()) {
                promise.reject("ERROR", "Missing sleep data or health data, skip calculateHealthScore");
                return;
            }
            ServiceSdkCommandV2.INSTANCE.calcuHealthAssessment(
                    startOfDay,
                    tempSleepRecords,
                    tempHealthRecords,
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new HealthScoreCallback() {
                        @Override
                        public void healthScore(HealthScore bean) {
                            if (bean == null) {
                                promise.reject("ERROR", "Failed to get health score");
                                return;
                            }
                            try {
                                WritableMap scoreMap = Arguments.createMap();
                                Long timestamp = bean.getDate() / 1000;
                                scoreMap.putLong("timestamp", timestamp);

                                SleepScore sleepScore = bean.getSleepScore();
                                if (sleepScore != null) {
                                    WritableMap sleepMap = Arguments.createMap();
                                    Field dateField = sleepScore.getClass().getDeclaredField("date");
                                    dateField.setAccessible(true);
                                    sleepMap.putLong("timestamp", timestamp);
                                    sleepMap.putInt("sleepScore", sleepScore.getSleepScore());
                                    sleepMap.putInt("sleepDurationScore", sleepScore.getSleepDurationScore());
                                    sleepMap.putInt("sleepEfficiencyScore", sleepScore.getSleepEfficiencyScore());
                                    sleepMap.putInt("deepSleepScore", sleepScore.getDeepSleepScore());
                                    sleepMap.putInt("remSleepScore", sleepScore.getRemSleepScore());
                                    sleepMap.putInt("restfulnessScore", sleepScore.getRestfulnessScore());
                                    sleepMap.putInt("sleepBreathScore", sleepScore.getSleepBreathScore());
                                    scoreMap.putMap("sleepScore", sleepMap);
                                }

                                ActivityScore activityScore = bean.getActivityScore();
                                if (activityScore != null) {
                                    WritableMap activityMap = Arguments.createMap();
                                    Field field = activityScore.getClass().getDeclaredField("date");
                                    field.setAccessible(true);
                                    activityMap.putLong("timestamp", timestamp);
                                    activityMap.putInt("activityScore", activityScore.getActivityScore());
                                    activityMap.putInt("stayActivityScore", activityScore.getStayActivityScore());
                                    activityMap.putInt("meatDailyGoalScore", activityScore.getMeatDailyGoalScore());
                                    activityMap.putInt("exerciseFrequencyScore",
                                            activityScore.getExerciseFrequencyScore());
                                    activityMap.putInt("exerciseVolumeScore", activityScore.getExerciseVolumeScore());
                                    scoreMap.putMap("activityScore", activityMap);
                                }

                                ReadinessScore readinessScore = bean.getReadinessScore();
                                if (readinessScore != null) {
                                    WritableMap readinessMap = Arguments.createMap();
                                    Field field = readinessScore.getClass().getDeclaredField("date");
                                    field.setAccessible(true);
                                    readinessMap.putLong("timestamp", timestamp);
                                    readinessMap.putInt("readinessScore", readinessScore.getReadinessScore());
                                    readinessMap.putInt("previousSleepScore", readinessScore.getPreviousSleepScore());
                                    readinessMap.putInt("previousActivityScore",
                                            readinessScore.getPreviousActivityScore());
                                    readinessMap.putInt("recoveryIndexScore", readinessScore.getRecoveryIndexScore());
                                    readinessMap.putInt("temperatureScore", readinessScore.getTemperatureScore());
                                    readinessMap.putInt("rhrScore", readinessScore.getRhrScore());
                                    scoreMap.putMap("readinessScore", readinessMap);
                                }

                                WritableArray dataArr = Arguments.createArray();
                                dataArr.pushMap(scoreMap);
                                WritableMap body = Arguments.createMap();
                                body.putString("type", RingDataUpdateType.HEALTHY_SCORE.toString());
                                body.putArray("data", dataArr);
                                sendEvent("deviceDataUpdate", body);
                                promise.resolve(true);
                            } catch (Exception e) {
                                promise.reject("ERROR", "Failed to build health score", e);
                            }
                        }
                    });
        };

        // 查询指定日期的睡眠数据
        ServiceSdkCommandV2.INSTANCE.getSleepData(startOfDay, new SleepDataCallback() {
            @Override
            public void sleepData(List<SleepRecord> list) {
                if (list != null && !list.isEmpty()) {
                    Log.d(TAG, list.toString());

                    WritableMap map = Arguments.createMap();
                    WritableArray napdetails = Arguments.createArray();

                    // 存在只有小睡的case， 这种数据不进行上传
                    boolean hasSleepData = false;

                    for (SleepRecord record : list) {
                        tempSleepRecords.add(record);

                        if (record.getSleepType() == 0) {
                            hasSleepData = true;
                            map.putLong("timestamp", record.getDate() / 1000);
                            map.putInt("measurementType", record.getMeasureType());
                            map.putInt("deepSleepDuration", record.getDeepDuration());
                            map.putInt("lightSleepDuration", record.getLightDuration());
                            map.putInt("awakeDuration", record.getAwakeDuration());
                            map.putLong("notWornDuration", 0);
                            map.putInt("awakeCount", record.getAwakeTimes());
                            map.putInt("remSleepDuration", record.getRemDuration());
                            map.putInt("totalSleepDuration", record.getTotalDuration());
                            Long startTimestamp = record.getStartTime() / 1000;
                            String startTimeStr = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                                    .format(new Date(record.getStartTime()));
                            map.putString("startTimeStr", startTimeStr);
                            map.putLong("startTimestamp", startTimestamp);
                            String endTimeStr = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                                    .format(new Date(record.getEndTime()));
                            map.putString("endTimeStr", endTimeStr);
                            Long endTimestamp = record.getEndTime() / 1000;
                            map.putLong("endTimestamp", endTimestamp);
                            WritableArray detailsArr = Arguments.createArray();
                            List<SleepStage> stages = record.getSleepDetails();
                            if (stages != null) {
                                for (SleepStage stage : stages) {
                                    WritableMap d = Arguments.createMap();
                                    d.putLong("timestamp", stage.getTime() / 1000);
                                    d.putString("timestampStr", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                                            .format(new Date(stage.getTime())));
                                    d.putInt("sleepType", stage.getMode());
                                    d.putLong("startTimestamp", startTimestamp);
                                    d.putString("startTimeStr", startTimeStr);
                                    detailsArr.pushMap(d);
                                }
                            }
                            map.putArray("sleepDetails", detailsArr);
                        } else {
                            // 1 零星小睡逻辑：从 SleepRecord 填充 BTNapDetailModel 兼容字段
                            WritableMap napDetailMap = Arguments.createMap();
                            napDetailMap.putString("startTimeStr", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                                    .format(new Date(record.getStartTime())));
                            napDetailMap.putString("endTimeStr",
                                    new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date(record.getEndTime())));
                            napDetailMap.putLong("startTimestamp", record.getStartTime() / 1000);
                            napDetailMap.putLong("endTimestamp", record.getEndTime() / 1000);
                            napDetailMap.putInt("durationInMinutes", record.getTotalDuration());
                            napdetails.pushMap(napDetailMap);
                        }
                    }

                    if (hasSleepData) {
                        map.putArray("napDetails", napdetails);

                        WritableMap body = Arguments.createMap();
                        body.putString("type", RingDataUpdateType.SLEEP.toString());
                        WritableArray arr = Arguments.createArray();
                        arr.pushMap(map);
                        body.putArray("data", arr);
                        sendEvent("deviceDataUpdate", body);
                    }

                }

                // 睡眠回调结束后再查询健康（串行，避免与睡眠并行占满通信）
                ServiceSdkCommandV2.INSTANCE.getHealthData(startOfDay, new HealthDataCallback() {
                    @Override
                    public void onReceive(List<HealthDataBean> list) {

                        String fastjsonArr = new JSONArray(Collections.singletonList(list)).toString();
                        Log.d(TAG, fastjsonArr);

                        if (list == null)
                            return;
                        for (HealthDataBean bean : list) {
                            WritableMap map = Arguments.createMap();

                            map.putDouble("date", bean.getDate() / 1000);
                            map.putLong("timestamp", bean.getTime() / 1000);
                            map.putString("timeStr",
                                    new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date(bean.getTime())));
                            map.putInt("dailyHeartRate", bean.getHr());
                            map.putInt("hrv", bean.getHrv());
                            map.putInt("spo2", bean.getBo());
                            map.putInt("stress", bean.getStress());
                            map.putInt("distance", bean.getDistance());
                            map.putInt("calories", bean.getCalorie());
                            map.putDouble("steps", bean.getStep());
                            map.putDouble("environmentTemperature", bean.getEnvtp());
                            map.putDouble("bodyTemperature", bean.getTemp());
                            map.putBoolean("sosAlert", bean.getSos() != 0);
                            healthEventBuffer.add(map);

                            HealthRecord record = new HealthRecord();
                            record.setBo(bean.getBo());
                            record.setCalorie(bean.getCalorie());
                            record.setDate(bean.getDate());
                            record.setDevice(bean.getDevice());
                            record.setDistance(bean.getDistance());
                            record.setEnvtp(bean.getEnvtp());
                            record.setHr(bean.getHr());
                            record.setHrv(bean.getHrv());
                            record.setStep(bean.getStep());
                            record.setTemp(bean.getTemp());
                            record.setTime(bean.getTime());
                            tempHealthRecords.add(record);
                        }
                    }

                    @Override
                    public void onFinish(long time) {
                        if (!healthEventBuffer.isEmpty()) {
                            WritableMap body = Arguments.createMap();
                            body.putString("type", RingDataUpdateType.HEALTHY.toString());
                            WritableArray arr = Arguments.createArray();
                            for (WritableMap m : healthEventBuffer)
                                arr.pushMap(m);
                            body.putArray("data", arr);
                            sendEvent("deviceDataUpdate", body);

                        }
                        tryRunCalcu.run();
                    }
                });
            }
        });
    }

    // MARK: - 设备扫描和连接
    /**
     * 开始 BLE 扫描。调用前必须满足：蓝牙已开启，且 getBluetoothLeScanner() 非空，
     * 否则 BtUtil.searchBe 会因 BluetoothLeScanner 为 null 而 NPE。
     */
    @ReactMethod
    public void startScan() {
        // Context ctx = getReactApplicationContext();
        // BluetoothAdapter adapter = null;
        // if (ctx != null) {
        // BluetoothManager mgr = (BluetoothManager)
        // ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        // if (mgr != null)
        // adapter = mgr.getAdapter();
        // }
        // if (adapter == null) {
        // Log.w(TAG, "startScan: BluetoothAdapter is null, skip to avoid NPE in
        // BtUtil.searchBe");
        // return;
        // }
        // if (!adapter.isEnabled()) {
        // Log.w(TAG, "startScan: Bluetooth is disabled, skip to avoid NPE in
        // BtUtil.searchBe");
        // return;
        // }
        // BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        // if (scanner == null) {
        // Log.w(TAG, "startScan: BluetoothLeScanner is null (BT off or not ready), skip
        // to avoid NPE in BtUtil.searchBe");
        // return;
        // }

        Log.d(TAG, "startScan");
        ServiceSdkCommandV2.INSTANCE.searchBtDevice(null, null, new ArrayList<>(), true,
                new OnBluetoothSearchListener() {
                    @Override
                    public void end() {
                        Log.d(TAG, "扫描结束");
                    }

                    @Override
                    public void search(@NonNull ExBluetoothDevice exBluetoothDevice) {

                        if (exBluetoothDevice.getName().equals("DREAME RING")) {
                            WritableMap params = Arguments.createMap();
                            params.putString("macAddress", exBluetoothDevice.getAddress());
                            params.putString("name", exBluetoothDevice.getName());
                            params.putString("brand", RingBrand.yanqiang.toString());
                            sendEvent("devicesListAdd", params);
                        }

                    }

                    @Override
                    public void start() {
                        Log.d(TAG, "扫描开始");
                    }
                });
    }

    @ReactMethod
    public void stopScan() {
        ServiceSdkCommandV2.INSTANCE.stopSearchBtDevice();
    }

    @ReactMethod
    public void bindDevice(String macAddress) {
        Log.d(TAG, "bindDevice " + macAddress);
        ServiceSdkCommandV2.INSTANCE.connect(macAddress);
        ServiceSdkCommandV2.INSTANCE.addCallback(connectCallback);
    }

    @ReactMethod
    public void reconnectDevice(String macAddress) {
        Log.d(TAG, "reconnectDevice " + macAddress);
        if (DeviceManager.INSTANCE.isConnect()) {
            Log.d(TAG, "先disconnect " + macAddress);
            DeviceManager.INSTANCE.removeCallback(connectCallback);
            DeviceManager.INSTANCE.disconnect();
        }
        this.bindDevice(macAddress);
    }

    // MARK: - 设备操作
    @ReactMethod
    public void resetDevice(Promise promise) {
        if (DeviceManager.INSTANCE.isConnect()) {
            ServiceSdkCommandV2.INSTANCE.handleDevice(1, new BCallback() {
                @Override
                public void result(boolean b) {
                    if (b) {
                        promise.resolve(true);
                    } else {
                        promise.reject("Failed", "Reset device failed");

                    }
                }
            });
        } else {
            promise.reject("Failed", "Device not connected");
        }
    }

    @ReactMethod
    public void restartDevice(Promise promise) {
        if (DeviceManager.INSTANCE.isConnect()) {
            ServiceSdkCommandV2.INSTANCE.handleDevice(4, new BCallback() {
                @Override
                public void result(boolean b) {
                    if (b) {
                        promise.resolve(true);
                    } else {
                        promise.reject("Failed", "Restart device failed");

                    }
                }
            });
        } else {
            promise.reject("Failed", "Device not connected");
        }
    }

    @ReactMethod
    public void unbindDevice(Promise promise) {
        ServiceSdkCommandV2.INSTANCE.handleDevice(2, new BCallback() {
            @Override
            public void result(boolean b) {
                if (b) {
                    // Log.d(TAG,"unbindDevice success");
                    promise.resolve(true);
                    sendEvent("ringStatusUpdated", -7);
                } else {
                    // Log.d(TAG,"unbindDevice failed");
                    // promise.reject("Failed", "Restart device failed");
                    DeviceManager.INSTANCE.removeCallback(connectCallback);
                    DeviceManager.INSTANCE.disconnect();

                    promise.resolve(true);
                    sendEvent("ringStatusUpdated", -7);
                }
            }
        });
    }

    // MARK: - 用户偏好设置
    @ReactMethod
    public void getUserPref(Promise promise) {
    }

    @ReactMethod
    public void updateUserPref(ReadableMap userPref, Promise promise) {
    }

    private int getMeasureType(String type) {
        if (type.equals("heartRate")) {
            return 0x01;
        } else if (type.equals("bloodOxygen")) {
            return 0x02;
        } else if (type.equals("skinTemperature")) {
            return 0x06;
        }

        // 异常
        throw new Error("getMeasureType error type");
    }

    // MARK: - 测量相关
    @ReactMethod
    public void startMeasurement(final String type, final Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected");
            return;
        }

        currentMeasureType = type;
        ServiceSdkCommandV2.INSTANCE.instantMeasurement(
                getMeasureType(type),
                1,
                new MeasureResultCallback() {
                    @Override
                    public void measureResult(MeasureResult bean) {
                        Boolean resultValue = bean.getResult();
                        if (!resultValue) {
                            currentMeasureType = null;
                            promise.reject("ERROR", "measurement result failed");
                            return;
                        }

                        try {
                            double measurementResultValue;
                            switch (type) {
                                case "heartRate":
                                    measurementResultValue = bean.getHeartrate();
                                    break;
                                case "bloodOxygen":
                                    measurementResultValue = bean.getBloodoxygen();
                                    break;
                                case "skinTemperature":
                                    measurementResultValue = bean.getBodytemp();
                                    break;
                                default:
                                    measurementResultValue = 0.0;
                                    break;
                            }

                            long timeInSeconds = bean.getTime() / 1000;

                            WritableMap resultMap = Arguments.createMap();
                            resultMap.putDouble("measurementResult", measurementResultValue);
                            resultMap.putDouble("measurementTime", (double) timeInSeconds);
                            currentMeasureType = null;
                            promise.resolve(resultMap);
                        } catch (Exception e) {
                            currentMeasureType = null;
                            promise.reject("ERROR", "Failed to parse measurement result: " + e.getMessage(), e);
                        }
                    }
                });
    }

    @ReactMethod
    public void stopMeasurement(final String type, final Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected");
            return;
        }

        ServiceSdkCommandV2.INSTANCE.instantMeasurement(
                getMeasureType(type),
                2,
                new MeasureResultCallback() {
                    @Override
                    public void measureResult(MeasureResult bean) {
                        boolean resultValue = bean.getResult();
                        if (!resultValue) {
                            currentMeasureType = null;
                            promise.reject("ERROR", "Failed to stop measurement");
                        } else {
                            currentMeasureType = null;
                            promise.resolve(null);
                        }
                    }
                });
    }

    // MARK: - 通知设置
    @ReactMethod
    public void updateNotificationStates(ReadableArray states, Promise promise) {
        // TODO: 实现更新通知状态
    }

    @ReactMethod
    public void getNotificationStates(Promise promise) {
        // TODO: 实现获取通知状态
    }

    /**
     * 全选/取消全选通知列表（通知原生 AppIconsNotificationLayout 更新勾选状态）。
     * 
     * @param value true 全选，false 取消全选
     */
    @ReactMethod
    public void setAllNotificationSelected(boolean value) {
        NotificationSelection.INSTANCE.setAllSelected(value);
    }

    // MARK: - 设备信息查询
    @ReactMethod
    public void queryRingInfo(Promise promise) {
        FirmwareParams firmwareParams = ServiceSdkCommandV2.INSTANCE.getFirmwareParams();
        WritableMap params = Arguments.createMap();
        params.putString("serialNumber", firmwareParams.getProductSn());
        params.putString("firmwareVersion", firmwareParams.getFwmVersion());
        // RN 统一字段名 projectCode，值来自 SDK 的 modelName（与 iOS BTAboutModel.projectCode 语义对齐）
        String modelName = firmwareParams.getModelName();
        params.putString("projectCode", modelName != null ? modelName : "");
        promise.resolve(params);
    }

    // MARK: - OTA（研强 Aizo，与 RN OTAUpdatePage / 玉成 otaUpdate 事件结构一致，参考 MainActX
    // ServiceSdkCommandV2.startDeviceOtaUpdate）

    private void sendRingOtaEvent(String phase, WritableMap payload) {
        WritableMap body = Arguments.createMap();
        body.putString("phase", phase);
        if (payload != null) {
            body.merge(payload);
        }
        sendEvent("otaUpdate", body);
    }

    private boolean hasBlePermissionForOta() {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(activity,
                    Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
                    && ContextCompat.checkSelfPermission(activity,
                            Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return ContextCompat.checkSelfPermission(activity,
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void finishOtaSuccess(Promise promise) {
        if (otaFinished) {
            return;
        }
        otaFinished = true;
        otaInProgress = false;
        promise.resolve(true);
    }

    private void finishOtaFailed(Promise promise, String code, String message) {
        if (otaFinished) {
            return;
        }
        otaFinished = true;
        otaInProgress = false;
        promise.reject(code, message);
    }

    @ReactMethod
    public void startOTAUpdate(String filePath, Promise promise) {
        if (otaInProgress) {
            promise.reject("OTA_BUSY", "Another OTA is already in progress");
            return;
        }
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null");
            return;
        }
        if (!hasBlePermissionForOta()) {
            promise.reject("NO_BLE_PERMISSION", "Bluetooth permission is required for OTA");
            return;
        }
        if (!isConnected()) {
            promise.reject("NO_DEVICE", "Device not connected");
            return;
        }
        if (filePath == null || filePath.trim().isEmpty()) {
            promise.reject("INVALID_FILE", "Firmware file path is empty");
            return;
        }
        String normalizedPath = filePath.trim();
        if (normalizedPath.startsWith("file://")) {
            normalizedPath = normalizedPath.substring("file://".length());
        }
        File firmwareFile = new File(normalizedPath);
        if (!firmwareFile.exists() || !firmwareFile.isFile()) {
            promise.reject("INVALID_FILE", "Firmware file not found");
            return;
        }

        otaInProgress = true;
        otaFinished = false;

        WritableMap preparing = Arguments.createMap();
        preparing.putString("dfuState", "preparing");
        preparing.putString("message", "starting OTA");
        sendRingOtaEvent("state", preparing);

        ServiceSdkCommandV2.INSTANCE.startDeviceOtaUpdate(normalizedPath, new DeviceOtaResultCallback() {
            @Override
            public void onProgress(int progress) {
                int p = Math.min(100, Math.max(0, progress));
                WritableMap map = Arguments.createMap();
                map.putInt("progress", p);
                sendRingOtaEvent("progress", map);
            }

            @Override
            public void onSuccess() {
                WritableMap p = Arguments.createMap();
                p.putInt("progress", 100);
                sendRingOtaEvent("progress", p);

                WritableMap done = Arguments.createMap();
                done.putBoolean("success", true);
                sendRingOtaEvent("complete", done);
                finishOtaSuccess(promise);
            }

            @Override
            public void onFail(int state) {
                WritableMap error = Arguments.createMap();
                error.putString("code", "OTA_FAILED");
                error.putString("message", "OTA failed, state=" + state);
                error.putInt("state", state);
                sendRingOtaEvent("error", error);

                WritableMap done = Arguments.createMap();
                done.putBoolean("success", false);
                sendRingOtaEvent("complete", done);
                finishOtaFailed(promise, "OTA_FAILED", "OTA failed, state=" + state);
            }
        });
    }

    @ReactMethod
    public void queryRealStepData() {
        if (!isConnected()) {
            return;
        }
        ServiceSdkCommandV2.INSTANCE.getStepData(new StepDataCallback() {
            @Override
            public void onStepDataCallback(int step, float calories, int distance) {
                WritableMap params = Arguments.createMap();
                params.putDouble("distance", Double.valueOf(distance) / 100.0);
                params.putDouble("calories", calories * 10.0);
                params.putInt("steps", step);
                sendEvent("realtimeStepUpdate", params);
            }
        });

    }

    // MARK: - 震动设置

    // 实现查询震动开关设置
    @ReactMethod
    public void queryVibrationSwitchSettings(int type, Promise promise) {
        int typeValue = type <= 0 ? 0 : type;
        ServiceSdkCommandV2.INSTANCE.getVibrateToggle(typeValue, new VibrateToggleCallback() {
            @Override
            public void onVibrateToggle(@NonNull List<VibrateToggleModel> list) {
                try {
                    WritableArray resultArray = Arguments.createArray();
                    for (VibrateToggleModel model : list) {
                        WritableMap result = Arguments.createMap();
                        result.putInt("type", model.getType());
                        result.putBoolean("isOn", model.getStatus() == 1);
                        resultArray.pushMap(result);
                    }
                    promise.resolve(resultArray);
                } catch (Exception e) {
                    promise.reject("ERROR", "Failed to parse vibrate toggle: " + e.getMessage(), e);
                }
            }
        });
    }

    private void applyVibrateToggleSettings(List<VibrateToggleModel> list, Promise p) {
        ServiceSdkCommandV2.INSTANCE.setVibrateToggle(
                list,
                new BCallback() {
                    @Override
                    public void result(boolean r) {
                        if (r) {
                            p.resolve(true);
                        } else {
                            p.reject("ERROR", "Failed to send switch settings");
                        }
                    }
                });
    }

    /** 跳转本应用「应用信息」页，用户可在权限中手动开启（如已拒绝且不再弹出系统对话框时）。 */
    private void openApplicationDetailsSettings(@NonNull Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", activity.getPackageName(), null));
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "openApplicationDetailsSettings failed", e);
        }
    }

    /**
     * 与 {@link Settings} 中部分版本未随 compileSdk 暴露的常量一致，避免编译期找不到符号。
     */
    private static final String ACTION_APP_PERMISSION_SETTINGS = "android.settings.APP_PERMISSION_SETTINGS";

    /**
     * 打开本应用「应用权限」列表（含「电话」分组，可开启 READ_PHONE_STATE）。API 26+ 使用该
     * action；更低版本回退到应用信息页。
     */
    private void openAppPhonePermissionSettings(@NonNull Activity activity) {
        String pkg = activity.getPackageName();
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(ACTION_APP_PERMISSION_SETTINGS);
                intent.setData(Uri.fromParts("package", pkg, null));
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", pkg, null));
            }
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "openAppPhonePermissionSettings failed", e);
            openApplicationDetailsSettings(activity);
        }
    }

    // 实现发送开关设置
    @ReactMethod
    public void sendSwitchSettings(ReadableArray settings, Promise promise) {
        List<VibrateToggleModel> vibrateToggleList = new ArrayList<>();
        VibrateToggleModel inCallModel = null;
        for (int i = 0; i < settings.size(); i++) {
            ReadableMap setting = settings.getMap(i);
            int type = setting.getInt("type");
            boolean isOn = setting.getBoolean("isOn");
            if (type == 4) {
                inCallModel = new VibrateToggleModel(type, isOn ? 1 : 0);
            }
            vibrateToggleList.add(new VibrateToggleModel(type, isOn ? 1 : 0));
        }
        if (vibrateToggleList.size() == 1 && inCallModel != null) {
            Log.d(TAG, "type = " + inCallModel.getType() + " isOn = " + (inCallModel.getStatus() == 1));
            boolean isOn = inCallModel.getStatus() == 1;
            if (isOn) {
                if (!CallManager.INSTANCE.hasCallPermission(getReactApplicationContext())) {
                    Log.w(TAG, "无法请求 READ_PHONE_STATE, 请前往系统页自行开启");
                    promise.resolve(false);
                    return;
                } else {
                    boolean registerSuccess = CallManager.INSTANCE
                            .checkAndRegisterCallListener(getReactApplicationContext());
                    if (!registerSuccess) {
                        Log.w(TAG, "注册来电监听失败，取消本次来电提醒开关开启");
                        promise.reject(new Throwable("APP的电话权限开启失败，请重试"));
                        return;
                    }
                }
            } else {
                CallManager.INSTANCE.unregisterCallListener(getReactApplicationContext());
            }
        }
        applyVibrateToggleSettings(vibrateToggleList, promise);
    }

    // 实现发送震动
    // 1/2/3/4/5
    @ReactMethod
    public void sendVibrationWithType(int type, Promise promise) {
        if (type < 1 || type > 5) {
            promise.reject("ERROR", "Invalid vibration type");
            return;
        }
        ServiceSdkCommandV2.INSTANCE.callVibrationExperience(type, new BCallback() {
            @Override
            public void result(boolean result) {
                if (result) {
                    promise.resolve(true);
                } else {
                    promise.reject("ERROR", "Failed to send vibration with type");
                }
            }
        });
    }

    // MARK: - 运动相关

    // 当前运动状态
    private Long currentSportId = null;
    private Integer currentSportType = null;
    // 运动实时数据查询计时器
    private Handler sportDataHandler = null;
    private Runnable sportDataRunnable = null;
    private static final long SPORT_DATA_INTERVAL = 5000; // 5秒查询一次实时数据
    private long lastFetchTime = 0;
    private long lastSportId = 0;

    @ReactMethod
    public void startSport(int type, Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }
        // 开始运动前先获取运动状态（参考 Android Demo：getSportStatus）
        // 0: 无运动可立即开始；1/2: 有进行中运动需先 sportStopAndGetRecord；3: 有未同步数据需先 getSportRecord
        try {
            ServiceSdkCommandV2.INSTANCE.getSportStatus(new SportStatusCallback() {
                @Override
                public void status(SportStatus bean) {
                    if (bean == null) {
                        doStartSport(type, promise);
                        return;
                    }
                    int s = bean.getSportStatus();
                    if (s == 0) {
                        doStartSport(type, promise);
                        return;
                    }
                    if (s == 1 || s == 2) {
                        final long sid = bean.getSportId();
                        final int styp = bean.getSportType();
                        ServiceSdkCommandV2.INSTANCE.sportStopAndGetRecord(
                                sid,
                                styp,
                                new ICallback() {
                                    @Override
                                    public void result(int r) {
                                        if (r == 1) {
                                            stopSportDataTimer();
                                            currentSportId = null;
                                            currentSportType = null;
                                            doStartSport(type, promise);
                                        } else {
                                            promise.reject("STOP_FAILED", "Failed to stop current sport, result: " + r,
                                                    (Throwable) null);
                                        }
                                    }
                                },
                                new SportRecordCallback() {
                                    @Override
                                    public void onSportRecord(SportRecord record) {
                                        // sendSportRecordEvent(record);
                                    }
                                });
                        return;
                    }
                    if (s == 3) {
                        ServiceSdkCommandV2.INSTANCE.getSportRecord(new SportRecordCallback() {
                            @Override
                            public void onSportRecord(SportRecord record) {
                                // sendSportRecordEvent(record);
                                currentSportId = null;
                                currentSportType = null;
                                doStartSport(type, promise);
                            }
                        });
                        return;
                    }
                    doStartSport(type, promise);
                }
            });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start sport: " + e.getMessage(), e);
        }
    }

    /**
     * 实际执行 sportStart，由 startSport 在通过 getSportStatus 判断可开始后调用。
     */
    private void doStartSport(int type, final Promise promise) {
        lastSportId = System.currentTimeMillis();
        try {
            ServiceSdkCommandV2.INSTANCE.sportStart(
                    type,
                    lastSportId,
                    new ICallback() {
                        @Override
                        public void result(int r) {
                            if (r == 1) {
                                long tempSportId = lastSportId;
                                byte[] sportIdBytes = new byte[8];
                                for (int i = 7; i >= 0; i--) {
                                    sportIdBytes[i] = (byte) (tempSportId & 0xFF);
                                    tempSportId >>>= 8;
                                }
                                StringBuilder hexString = new StringBuilder();
                                for (int i = 0; i < sportIdBytes.length; i++) {
                                    if (i > 0)
                                        hexString.append(" ");
                                    hexString.append(String.format("%02X", sportIdBytes[i] & 0xFF));
                                }
                                currentSportId = lastSportId;
                                currentSportType = type;
                                startSportDataTimer();
                                promise.resolve(hexString.toString());
                            } else {
                                promise.reject("START_FAILED", "Failed to start sport, result: " + r, (Throwable) null);
                            }
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start sport: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void pauseSport(Promise promise) {
        // 参考前端使用：前端不等待返回值，但需要 resolve Promise
        // 检查是否有正在进行的运动
        if (currentSportId == null || currentSportType == null) {
            // 没有正在进行的运动，直接返回成功（参考 iOS 实现：guard 检查后直接 return）
            promise.resolve(true);
            return;
        }

        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }

        // 根据 iOS 实现和 Android SDK demo：
        // 调用 sportPause 暂停运动
        // ICallback.result(r: Int) 中 r == 1 表示成功
        try {
            ServiceSdkCommandV2.INSTANCE.sportPause(
                    currentSportType,
                    currentSportId,
                    new ICallback() {
                        @Override
                        public void result(int r) {
                            if (r == 1) {
                                // 暂停成功，停止实时数据查询（参考 iOS 实现）
                                stopSportDataTimer();
                                promise.resolve(true);
                            } else {
                                // 暂停失败
                                promise.reject("PAUSE_FAILED", "Failed to pause sport, result: " + r, (Throwable) null);
                            }
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to pause sport: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void resumeSport(Promise promise) {
        // 参考前端使用：前端不等待返回值，但需要 resolve Promise
        // 检查是否有正在进行的运动
        if (currentSportId == null || currentSportType == null) {
            // 没有正在进行的运动，直接返回成功（参考 iOS 实现：guard 检查后直接 return）
            promise.resolve(true);
            return;
        }

        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }

        // 根据 iOS 实现和 Android SDK demo：
        // 调用 sportResume 恢复运动
        // ICallback.result(r: Int) 中：
        // r == 1 表示恢复成功
        // r == 3 表示设备已停止运动（需要清理状态）
        // 其他值表示恢复失败
        try {
            ServiceSdkCommandV2.INSTANCE.sportResume(
                    currentSportType,
                    currentSportId,
                    new ICallback() {
                        @Override
                        public void result(int r) {
                            if (r == 1) {
                                // 恢复成功，重新启动实时数据查询（参考 iOS 实现）
                                startSportDataTimer();
                                promise.resolve(true);
                            } else if (r == 3) {
                                // 设备已停止运动，清理状态
                                stopSportDataTimer();
                                currentSportId = null;
                                currentSportType = null;
                                promise.reject("SPORT_STOPPED", "Device has stopped the sport", (Throwable) null);
                            } else {
                                // 恢复失败
                                promise.reject("RESUME_FAILED", "Failed to resume sport, result: " + r,
                                        (Throwable) null);
                            }
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to resume sport: " + e.getMessage(), e);
        }
    }

    /**
     * 将 SportRecord 转为与 iOS 一致的格式并通过 deviceDataUpdate 发出（type=EXERCISE）。
     * 供 stopSport、sportStopAndGetRecord、getSportRecord 复用。
     */
    private void sendSportRecordEvent(SportRecord record) {
        if (record == null)
            return;
        try {
            // 结束运动时的 sportID 必须与开始运动的 lastSportId 一致。 currentSportId；再空则用
            // lastSportId（stopSport 回调里 currentSportId 已置空）
            long sportId = currentSportId != null ? currentSportId : lastSportId;
            byte[] sportIdBytes = new byte[8];
            long tempSportId = sportId;
            for (int i = 7; i >= 0; i--) {
                sportIdBytes[i] = (byte) (tempSportId & 0xFF);
                tempSportId >>>= 8;
            }
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < sportIdBytes.length; i++) {
                if (i > 0)
                    hexString.append(" ");
                hexString.append(String.format("%02X", sportIdBytes[i] & 0xFF));
            }
            String sportIDHex = hexString.toString();

            long dateMs = record.getDate();
            long startTimeMs = record.getStartTime();
            long date = dateMs / 1000;
            long startTime = startTimeMs / 1000;

            WritableMap summary = Arguments.createMap();
            summary.putString("sportID", sportIDHex);
            summary.putInt("sportType", record.getSportType());
            summary.putDouble("date", date);
            summary.putDouble("startTime", startTime);
            summary.putInt("duration", (int) record.getDuration());
            summary.putInt("calories", Math.round(record.getCalorie() * 10.0f));
            summary.putInt("distance", Math.round(record.getDistance()));
            summary.putInt("steps", (int) record.getSteps());
            summary.putInt("heartRate", record.getAvgHr());
            summary.putInt("avgHr", record.getAvgHr());
            summary.putInt("maxHr", record.getMaxHr());
            summary.putInt("minHr", record.getMinHr());
            summary.putInt("avgPace", Math.round(record.getAvgPace()));
            summary.putInt("maxPace", Math.round(record.getMaxPace()));
            summary.putInt("minPace", Math.round(record.getMinPace()));
            summary.putDouble("avgSpeed", record.getAvgSpeed());
            summary.putDouble("maxSpeed", record.getMaxSpeed());
            summary.putDouble("minSpeed", record.getMinSpeed());
            summary.putInt("avgCadence", record.getAvgCadence());
            summary.putInt("maxCadence", record.getMaxCadence());
            summary.putInt("minCadence", record.getMinCadence());
            summary.putDouble("temperature", 0.0);

            java.util.List<com.eiot.ringsdk.bean.SportDetail> sportDetails = record.getSportDetails();
            WritableArray detailsModels = Arguments.createArray();
            if (sportDetails != null) {
                for (com.eiot.ringsdk.bean.SportDetail detail : sportDetails) {
                    WritableMap d = Arguments.createMap();
                    d.putInt("calories", Math.round(detail.getCalorie()));
                    d.putInt("distance", Math.round(detail.getDist()));
                    d.putInt("pace", Math.round(detail.getPace()));
                    d.putDouble("temperature", 0.0);
                    d.putInt("sportType", record.getSportType());
                    d.putString("sportID", sportIDHex);
                    d.putInt("timeID", (int) detail.getTime());
                    d.putDouble("speed", detail.getSpeed());
                    d.putInt("steps", (int) detail.getStep());
                    d.putInt("cadence", detail.getCadence());
                    d.putInt("heartRate", detail.getHr());
                    detailsModels.pushMap(d);
                }
            }
            summary.putArray("detailsModels", detailsModels);

            WritableArray dataArray = Arguments.createArray();
            dataArray.pushMap(summary);
            WritableMap eventData = Arguments.createMap();
            eventData.putString("type", "EXERCISE");
            eventData.putArray("data", dataArray);
            sendEvent("deviceDataUpdate", eventData);
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse sport record: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void stopSport(Promise promise) {
        // 参考前端使用：在 cleanup 中调用，可能没有正在进行的运动
        // 如果没有运动，直接返回成功（参考 iOS 实现：guard 检查后直接 return）
        if (currentSportId == null || currentSportType == null) {
            // 没有正在进行的运动，直接返回成功（前端不等待返回值，但需要 resolve Promise）
            promise.resolve(true);
            return;
        }

        if (!isConnected()) {
            // 即使设备未连接，也清理状态
            stopSportDataTimer();
            currentSportId = null;
            currentSportType = null;
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }

        // 根据 iOS 实现和 Android SDK demo：结束运动的 sportId 必须与开始时的 lastSportId 相同。
        // currentSportId 在 doStartSport 成功时被设为 lastSportId，故此处用 currentSportId 即满足要求。
        // sportStop 需要两个回调：ICallback（r==1 成功）、SportRecordCallback（运动记录）。
        try {
            ServiceSdkCommandV2.INSTANCE.sportStop(
                    currentSportType,
                    currentSportId,
                    new ICallback() {
                        @Override
                        public void result(int r) {
                            if (r == 1) {
                                // 停止成功，清理状态并停止实时数据查询
                                stopSportDataTimer();
                                Long stoppedSportId = currentSportId;
                                Integer stoppedSportType = currentSportType;
                                currentSportId = null;
                                currentSportType = null;

                                // 停止成功后返回成功
                                promise.resolve(true);
                            } else {
                                // 停止失败
                                promise.reject("STOP_FAILED", "Failed to stop sport, result: " + r, (Throwable) null);
                            }
                        }
                    },
                    new SportRecordCallback() {
                        @Override
                        public void onSportRecord(SportRecord record) {
                            sendSportRecordEvent(record);
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop sport: " + e.getMessage(), e);
        }
    }

    // MARK: - 触摸设置
    @ReactMethod
    public void queryTouchState(final Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected");
            return;
        }
        Log.d(TAG, "queryTouchState");
        ServiceSdkCommandV2.INSTANCE.getDeviceSmartTouchMode(new DeviceSmartTouchModeCallback() {
            @Override
            public void deviceSmartTouch(DeviceSmartTouchMode bean) {
                try {
                    WritableMap map = Arguments.createMap();
                    map.putInt("currentMode", bean.getTouchMode());
                    map.putBoolean("isTouchEnabled", bean.getTouchAppSwitch() == 1);
                    promise.resolve(map);
                } catch (Exception e) {
                    promise.reject("ERROR", "Failed to parse touch state: " + e.getMessage(), e);
                }
            }
        });
    }

    @ReactMethod
    public void updateTouchState(int mode, boolean value, final Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected");
            return;
        }

        // 参数验证
        if (mode < 0) {
            promise.reject("ERROR", "Invalid touch mode: " + mode);
            return;
        }

        BluetoothBondManager bluetoothBondManager = new BluetoothBondManager(getReactApplicationContext());
        bluetoothBondManager.ensureBondAuthorized(getDeviceMac(), new BluetoothBondManager.BondAuthorizationCallback() {
            @Override
            public void onAuthorized() {
                applyTouchState(mode, value, promise);
            }

            @Override
            public void onError(String message) {
                promise.reject("ERROR", message);
            }
        });
    }

    private void applyTouchState(int mode, boolean value, final Promise promise) {
        DeviceSmartTouchMode touchBean = new DeviceSmartTouchMode();
        touchBean.setTouchAppSwitch(value ? 1 : 0);
        touchBean.setTouchMode(mode);

        ServiceSdkCommandV2.INSTANCE.setDeviceSmartTouchMode(
                touchBean,
                new BCallback() {
                    @Override
                    public void result(boolean r) {
                        Log.d(TAG, "setDeviceSmartTouchMode result: " + r);
                        if (r) {
                            promise.resolve(true);
                        } else {
                            promise.reject("ERROR", "Failed to set touch state");
                        }
                    }
                });
    }

    // MARK: - 健康预警设置
    @ReactMethod
    public void queryHealthWarningSettings(int type, Promise promise) {
        int typeValue = type <= 0 ? 0 : type;
        ServiceSdkCommandV2.INSTANCE.getVibrateWaining(typeValue, new VibrateWainingDataCallback() {
            @Override
            public void onVibrateWainingData(@NonNull List<VibrateWainingModel> list) {
                try {
                    WritableArray resultArray = Arguments.createArray();
                    for (VibrateWainingModel model : list) {
                        WritableMap result = Arguments.createMap();
                        result.putInt("type", model.getType());
                        result.putBoolean("highSwitchOn", model.getTooHighToggle() == 1);
                        result.putInt("highThreshold", model.getTooHighValue());
                        result.putBoolean("lowSwitchOn", model.getTooLowToggle() == 1);
                        result.putInt("lowThreshold", model.getTooLowValue());
                        resultArray.pushMap(result);
                    }
                    promise.resolve(resultArray);
                } catch (Exception e) {
                    promise.reject("ERROR", "Failed to parse health warning settings: " + e.getMessage(), e);
                }
            }
        });
    }

    @ReactMethod
    public void sendHealthWarningSetting(ReadableMap setting, Promise promise) {
        try {
            int type = setting.getInt("type");
            boolean highSwitchOn = setting.getBoolean("highSwitchOn");
            int highThreshold = setting.getInt("highThreshold");
            boolean lowSwitchOn = setting.getBoolean("lowSwitchOn");
            int lowThreshold = setting.getInt("lowThreshold");

            VibrateWainingModel model = new VibrateWainingModel(
                    type,
                    highSwitchOn ? 1 : 0,
                    highThreshold,
                    lowSwitchOn ? 1 : 0,
                    lowThreshold);
            ServiceSdkCommandV2.INSTANCE.setVibrateWarning(
                    model,
                    new BCallback() {
                        @Override
                        public void result(boolean r) {
                            if (r) {
                                promise.resolve(true);
                            } else {
                                promise.reject("ERROR", "Failed to send health warning setting");
                            }
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to send health warning setting: " + e.getMessage(), e);
        }
    }

    // MARK: - 闹钟设置
    @ReactMethod
    public void queryAlarms(Promise promise) {
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }

        ServiceSdkCommandV2.INSTANCE.getVibrateAlarm(new VibrateAlarmsCallback() {
            @Override
            public void onVibrateAlarms(@NonNull List<AlarmModel> list) {
                try {
                    WritableArray resultArray = Arguments.createArray();
                    for (AlarmModel model : list) {
                        WritableMap result = Arguments.createMap();
                        // 基本信息
                        // id 应该是字符串类型，前端会使用 String(alarm.id || alarm.alarmID || '')
                        result.putString("id", String.valueOf(model.getId()));
                        result.putInt("alarmID", model.getId());

                        // 解析时间：time 是总分钟数（从 00:00 开始）
                        // 例如：862 表示 14:22（14*60+22=862）
                        long timeMinutes = model.getTime();
                        int hour = (int) (timeMinutes / 60);
                        int minute = (int) (timeMinutes % 60);
                        result.putInt("hour", hour);
                        result.putInt("minute", minute);
                        // 格式化时间字符串，确保两位数格式（前端期望格式：HH:mm）
                        // 前端会使用：alarm.time || `${String(alarm.hour || 0).length === 1 ? '0' :
                        // ''}${alarm.hour || 0}:...`
                        // 所以我们需要确保 time 格式正确
                        result.putString("time", String.format("%02d:%02d", hour, minute));

                        // 名称和开关状态
                        // 前端期望：name 默认为 '闹钟'，enabled 默认为 true（如果为 false 则显示 false）
                        String alarmName = model.getName();
                        if (alarmName == null || alarmName.trim().isEmpty()) {
                            alarmName = "闹钟";
                        }
                        result.putString("name", alarmName);
                        // enabled 必须明确设置，前端会检查 alarm.enabled !== false
                        // 获取 isOpen 值，使用反射或直接访问字段
                        int isOpen = 0;
                        try {
                            // 尝试使用反射获取 isOpen 字段
                            java.lang.reflect.Field field = model.getClass().getDeclaredField("isOpen");
                            field.setAccessible(true);
                            Object value = field.get(model);
                            if (value instanceof Integer) {
                                isOpen = (Integer) value;
                            } else if (value instanceof Number) {
                                isOpen = ((Number) value).intValue();
                            }
                        } catch (Exception e) {
                            // 如果反射失败，尝试调用可能的方法
                            try {
                                java.lang.reflect.Method method = model.getClass().getMethod("getIsOpen");
                                Object methodResult = method.invoke(model);
                                if (methodResult instanceof Integer) {
                                    isOpen = (Integer) methodResult;
                                } else if (methodResult instanceof Number) {
                                    isOpen = ((Number) methodResult).intValue();
                                }
                            } catch (Exception e2) {
                                // 如果都失败，尝试 getOpen
                                try {
                                    java.lang.reflect.Method method = model.getClass().getMethod("getOpen");
                                    Object methodResult = method.invoke(model);
                                    if (methodResult instanceof Integer) {
                                        isOpen = (Integer) methodResult;
                                    } else if (methodResult instanceof Number) {
                                        isOpen = ((Number) methodResult).intValue();
                                    }
                                } catch (Exception e3) {
                                    // 默认值为 0（关闭）
                                    isOpen = 0;
                                }
                            }
                        }
                        result.putBoolean("enabled", isOpen == 1);

                        // 解析重复天数：repeats 是 char[]，根据 SDK 格式：
                        // repeats 数组元素为字符码 0 (\u0000) 或 1 (\u0001)
                        // 字符码 1 表示重复，字符码 0 表示不重复
                        // repeats 数组索引对应关系：repeats[0]=周一, repeats[1]=周二, repeats[2]=周三, repeats[3]=周四,
                        // repeats[4]=周五, repeats[5]=周六, repeats[6]=周日
                        // 前端使用的 day 值：0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
                        char[] repeats = model.getRepeats();
                        int repeatDays = 0;
                        ArrayList<Integer> repeatDaysArray = new ArrayList<>();
                        String[] dayLabels = { "周日", "周一", "周二", "周三", "周四", "周五", "周六" };
                        ArrayList<String> repeatLabels = new ArrayList<>();

                        if (repeats != null && repeats.length >= 7) {
                            // repeats 数组：0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
                            // 前端 day 值：0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
                            // 映射关系：repeats[i] -> 前端 day = (i == 6) ? 0 : (i + 1)
                            for (int i = 0; i < 7; i++) {
                                // 字符码 1 表示重复，字符码 0 表示不重复
                                // 兼容字符 '1' (ASCII 49) 和字符码 1，字符 '0' (ASCII 48) 和字符码 0
                                if (repeats[i] == (char) 1 || repeats[i] == '1') {
                                    // 将 repeats 索引转换为前端 day 值
                                    int frontendDay = (i == 6) ? 0 : (i + 1); // 0=周日, 1=周一, ..., 6=周六
                                    repeatDays |= (1 << frontendDay);
                                    repeatDaysArray.add(frontendDay);
                                    repeatLabels.add(dayLabels[frontendDay]);
                                }
                            }
                        }

                        result.putInt("repeatDays", repeatDays);
                        // 前端优先使用 repeatDaysArray，如果没有则使用 repeatDays
                        WritableArray repeatDaysArrayWritable = Arguments.createArray();
                        for (Integer day : repeatDaysArray) {
                            repeatDaysArrayWritable.pushInt(day);
                        }
                        result.putArray("repeatDaysArray", repeatDaysArrayWritable);
                        // 同时提供 repeatDays 作为备用（前端会使用 alarm.repeatDaysArray || alarm.repeatDays || []）

                        // 生成重复描述文本
                        // 前端期望格式：'无重复'、'每天'、'周一、周二' 等
                        String repeatText;
                        if (repeatDaysArray.isEmpty()) {
                            repeatText = "无重复";
                        } else if (repeatDaysArray.size() == 7) {
                            repeatText = "每天";
                        } else if (repeatDaysArray.size() == 1) {
                            // 单个日期，直接显示
                            repeatText = repeatLabels.get(0);
                        } else {
                            // 多个日期，用顿号连接
                            repeatText = String.join("、", repeatLabels);
                        }
                        result.putString("repeat", repeatText);

                        resultArray.pushMap(result);
                    }
                    promise.resolve(resultArray);
                } catch (Exception e) {
                    promise.reject("ERROR", "Failed to parse alarms: " + e.getMessage(), e);
                }
            }
        });
    }

    @ReactMethod
    public void setAlarm(ReadableMap alarmData, Promise promise) {
        // SDK 设置参数格式：
        // {"id":1,"duration":5,"repeats":["\u0001","\u0001","\u0001","\u0000","\u0000","\u0000","\u0000"],"time":1232,"isOpen":1,"name":"alarm
        // name","opType":1}
        if (!isConnected()) {
            promise.reject("ERROR", "Device not connected", (Throwable) null);
            return;
        }

        try {
            // 解析闹钟类型
            String typeString = alarmData.getString("type");
            if (typeString == null) {
                promise.reject("ERROR", "Alarm type is required", (Throwable) null);
                return;
            }

            int opType;
            switch (typeString) {
                case "add":
                    opType = 1; // 新增
                    break;
                case "delete":
                    opType = 2; // 删除
                    break;
                case "modify":
                    opType = 3; // 修改
                    break;
                default:
                    promise.reject("ERROR", "Invalid alarm type", (Throwable) null);
                    return;
            }

            // 获取 alarmID
            // 前端可能传递 alarmID (number) 或 id (string)，都需要支持
            int alarmID;
            if (alarmData.hasKey("alarmID")) {
                alarmID = alarmData.getInt("alarmID");
            } else if (alarmData.hasKey("id")) {
                try {
                    // 尝试作为字符串解析
                    String idString = alarmData.getString("id");
                    if (idString != null && !idString.isEmpty()) {
                        alarmID = Integer.parseInt(idString);
                    } else {
                        // 如果字符串为空，尝试作为数字
                        alarmID = alarmData.getInt("id");
                    }
                } catch (Exception e) {
                    // 如果字符串解析失败，尝试作为数字
                    try {
                        alarmID = alarmData.getInt("id");
                    } catch (Exception e2) {
                        promise.reject("ERROR", "Invalid alarm ID format", e2);
                        return;
                    }
                }
            } else {
                promise.reject("ERROR", "Alarm ID is required", (Throwable) null);
                return;
            }

            // 如果是删除，只需要基本参数
            if (opType == 2) {
                AlarmModel alarmModel = new AlarmModel(
                        alarmID,
                        5, // duration，默认5分钟
                        new char[] { '0', '0', '0', '0', '0', '0', '0' }, // repeats，删除时不需要
                        0, // time，删除时不需要
                        0, // isOpen，删除时不需要
                        "", // name，删除时不需要
                        opType);

                ServiceSdkCommandV2.INSTANCE.setVibrateAlarm(
                        alarmModel,
                        new BCallback() {
                            @Override
                            public void result(boolean r) {
                                if (r) {
                                    promise.resolve(true);
                                } else {
                                    promise.reject("ERROR", "Failed to delete alarm", (Throwable) null);
                                }
                            }
                        });
                return;
            }

            // 新增或修改需要完整数据
            // 前端在修改时会传递所有字段，新增时也会传递完整数据
            int hour = alarmData.hasKey("hour") ? alarmData.getInt("hour") : 0;
            int minute = alarmData.hasKey("minute") ? alarmData.getInt("minute") : 0;
            String name = alarmData.hasKey("name") ? alarmData.getString("name") : "闹钟";
            // 前端在切换开关时会传递 enabled: !alarm.enabled，新增时默认为 true
            // 如果没有传递 enabled，默认为 true（前端代码中新增时 enabled: true）
            boolean enabled = !alarmData.hasKey("enabled") || alarmData.getBoolean("enabled");

            // 验证时间范围
            if (hour < 0 || hour >= 24 || minute < 0 || minute >= 60) {
                promise.reject("ERROR", "Invalid time: hour must be 0-23, minute must be 0-59", (Throwable) null);
                return;
            }

            // 验证和处理名称
            // 前端会传递 name.trim()，但为了安全还是再 trim 一次
            if (name != null) {
                name = name.trim();
            }
            if (name == null || name.isEmpty()) {
                name = "闹钟";
            }

            // 计算时间（总分钟数）
            long timeMinutes = hour * 60L + minute;

            // 处理重复天数
            // 根据 SDK 设置参数格式示例：
            // {"repeats":["\u0001","\u0001","\u0001","\u0000","\u0000","\u0000","\u0000"]}
            // \u0001 表示字符码 1（重复），\u0000 表示字符码 0（不重复）
            // repeats 数组索引对应关系：repeats[0]=周一, repeats[1]=周二, repeats[2]=周三, repeats[3]=周四,
            // repeats[4]=周五, repeats[5]=周六, repeats[6]=周日
            // 前端传递的 repeatDays 数组：0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
            // 映射关系：前端 day -> repeats 索引 = (day == 0) ? 6 : (day - 1)

            // 使用字符码 0 和 1，而不是字符 '0' 和 '1'
            // 字符码 0 = '\u0000' = (char)0
            // 字符码 1 = '\u0001' = (char)1
            char[] repeats = new char[] { (char) 0, (char) 0, (char) 0, (char) 0, (char) 0, (char) 0, (char) 0 };
            boolean hasRepeatDays = false;

            // 优先检查 repeatDaysArray
            if (alarmData.hasKey("repeatDaysArray")) {
                ReadableArray repeatDaysArray = alarmData.getArray("repeatDaysArray");
                if (repeatDaysArray != null && repeatDaysArray.size() > 0) {
                    hasRepeatDays = true;
                    for (int i = 0; i < repeatDaysArray.size(); i++) {
                        int day = repeatDaysArray.getInt(i);
                        // day 范围是 0-6，0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
                        // 映射到 repeats 索引：0(周日)->6, 1(周一)->0, 2(周二)->1, 3(周三)->2, 4(周四)->3, 5(周五)->4,
                        // 6(周六)->5
                        if (day >= 0 && day < 7) {
                            int repeatsIndex = (day == 0) ? 6 : (day - 1);
                            repeats[repeatsIndex] = (char) 1; // 使用字符码 1 表示重复
                        }
                    }
                }
            }

            // 如果没有 repeatDaysArray，检查 repeatDays（前端主要使用这个）
            if (!hasRepeatDays && alarmData.hasKey("repeatDays")) {
                try {
                    // 尝试作为数组读取（前端传递的是数组）
                    ReadableArray repeatDaysArray = alarmData.getArray("repeatDays");
                    if (repeatDaysArray != null && repeatDaysArray.size() > 0) {
                        hasRepeatDays = true;
                        for (int i = 0; i < repeatDaysArray.size(); i++) {
                            int day = repeatDaysArray.getInt(i);
                            // day 范围是 0-6，0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
                            // 映射到 repeats 索引：0(周日)->6, 1(周一)->0, 2(周二)->1, 3(周三)->2, 4(周四)->3, 5(周五)->4,
                            // 6(周六)->5
                            if (day >= 0 && day < 7) {
                                int repeatsIndex = (day == 0) ? 6 : (day - 1);
                                repeats[repeatsIndex] = (char) 1; // 使用字符码 1 表示重复
                            }
                        }
                    } else if (repeatDaysArray != null && repeatDaysArray.size() == 0) {
                        // 空数组表示无重复，保持默认值（全为字符码 0）
                        hasRepeatDays = true;
                    }
                } catch (Exception e) {
                    // 如果不是数组，尝试作为位掩码（兼容旧代码）
                    try {
                        int repeatDays = alarmData.getInt("repeatDays");
                        hasRepeatDays = true;
                        // 位掩码从低位到高位：0(周日), 1(周一), 2(周二), 3(周三), 4(周四), 5(周五), 6(周六)
                        // 映射到 repeats 索引：0(周日)->6, 1(周一)->0, 2(周二)->1, 3(周三)->2, 4(周四)->3, 5(周五)->4,
                        // 6(周六)->5
                        for (int i = 0; i < 7; i++) {
                            if ((repeatDays & (1 << i)) != 0) {
                                int repeatsIndex = (i == 0) ? 6 : (i - 1);
                                repeats[repeatsIndex] = (char) 1; // 使用字符码 1 表示重复
                            }
                        }
                    } catch (Exception e2) {
                        // 如果都失败，使用默认值（无重复，全为字符码 0）
                    }
                }
            }

            // 如果没有传递任何重复天数参数，默认为无重复（全为字符码 0）
            // 创建 AlarmModel
            AlarmModel alarmModel = new AlarmModel(
                    alarmID,
                    5, // duration，默认5分钟响铃时长
                    repeats,
                    timeMinutes,
                    enabled ? 1 : 0,
                    name != null ? name : "闹钟",
                    opType);

            ServiceSdkCommandV2.INSTANCE.setVibrateAlarm(
                    alarmModel,
                    new BCallback() {
                        @Override
                        public void result(boolean r) {
                            if (r) {
                                promise.resolve(true);
                            } else {
                                promise.reject("ERROR", "Failed to set alarm", (Throwable) null);
                            }
                        }
                    });
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to set alarm: " + e.getMessage(), e);
        }
    }

    // MARK: - 发送事件到 React Native
    private void sendEvent(String eventName, Object params) {
        getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    // MARK: - 工具方法
    private boolean isConnected() {
        return DeviceManager.INSTANCE.isConnect();
    }

    private String getDeviceMac() {
        return DeviceManager.INSTANCE.getMac();
    }

    // MARK: - 运动实时数据查询
    /**
     * 启动运动实时数据查询计时器
     * 参考 iOS 实现和 Android demo：每隔 5 秒查询一次实时数据
     */
    private void startSportDataTimer() {
        stopSportDataTimer(); // 先停止之前的计时器

        if (currentSportId == null || currentSportType == null) {
            return;
        }

        lastFetchTime = 0; // 重置上次查询时间

        sportDataHandler = new Handler(Looper.getMainLooper());
        sportDataRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentSportId == null || currentSportType == null) {
                    stopSportDataTimer();
                    return;
                }

                // 参考 iOS 实现：防止频繁查询（至少间隔 5 秒）
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastFetchTime < SPORT_DATA_INTERVAL) {
                    // 如果距离上次查询不足 5 秒，延迟执行
                    sportDataHandler.postDelayed(this, SPORT_DATA_INTERVAL - (currentTime - lastFetchTime));
                    return;
                }
                lastFetchTime = currentTime;

                // 查询实时数据
                querySportRealTimeData();

                // 安排下次查询
                sportDataHandler.postDelayed(this, SPORT_DATA_INTERVAL);
            }
        };

        // 立即执行一次，然后每隔 5 秒执行
        sportDataHandler.post(sportDataRunnable);
    }

    /**
     * 停止运动实时数据查询计时器
     */
    private void stopSportDataTimer() {
        if (sportDataHandler != null && sportDataRunnable != null) {
            sportDataHandler.removeCallbacks(sportDataRunnable);
            sportDataHandler = null;
            sportDataRunnable = null;
        }
        lastFetchTime = 0;
    }

    /**
     * 查询运动实时数据
     * 参考 Android demo：使用 getSportLiveData 获取实时数据
     */
    private void querySportRealTimeData() {
        if (!isConnected() || currentSportId == null || currentSportType == null) {
            return;
        }

        try {
            // 根据 Android demo：ServiceSdkCommandV2.getSportLiveData(sportType, sportId,
            // SportLiveDataCallback)
            ServiceSdkCommandV2.INSTANCE.getSportLiveData(
                    currentSportType,
                    currentSportId,
                    new com.eiot.ringsdk.callback.SportLiveDataCallback() {
                        @Override
                        public void onSportLiveData(com.eiot.ringsdk.bean.SportLiveData liveData) {
                            // System.out.println("onSportLiveData: " + liveData.toString());
                            // (sportId=1767013507440, sportType=9, sportStatus=1, time=10, step=22,
                            // calorie=0.9, dist=10.0, pace=423.0, speed=8.510638, cadence=132, hr=0)
                            if (liveData == null) {
                                return;
                            }

                            // 根据 Android demo：
                            // sportStatus == 1 或 2：运动进行中
                            // sportStatus == 3：设备已停止运动
                            int sportStatus = liveData.getSportStatus();

                            if (sportStatus == 1 || sportStatus == 2) {
                                // 运动进行中，发送实时数据更新事件
                                // 参考 iOS 实现：发送 sportDataRealTimeUpdate 事件
                                // iOS 使用 BTSportRealTimeModel.toJSONString() 发送完整数据
                                try {
                                    WritableMap sportData = Arguments.createMap();

                                    // 根据 iOS BTSportRealTimeModel.toJSONString() 输出格式映射数据
                                    // iOS 字段名（小写驼峰）：
                                    // sportID, sportMode, status, timeID, calories, steps, distance,
                                    // temperature, heartRate, pace, speed, cadence

                                    // 基本字段 - 与 iOS 字段名保持一致
                                    // iOS: status (BTSportStatusType) -> 整数
                                    sportData.putInt("status", sportStatus);

                                    // iOS: sportMode (NSUInteger)
                                    sportData.putInt("sportMode", currentSportType != null ? currentSportType : 0);

                                    // iOS: sportID (NSData) - 转换为十六进制字符串，用空格分隔（与 iOS 格式一致）
                                    // iOS 格式示例："19 0C 1D 11 26 0F"
                                    if (currentSportId != null) {
                                        long tempSportId = currentSportId;
                                        byte[] sportIdBytes = new byte[8];
                                        for (int i = 7; i >= 0; i--) {
                                            sportIdBytes[i] = (byte) (tempSportId & 0xFF);
                                            tempSportId >>>= 8;
                                        }
                                        StringBuilder hexString = new StringBuilder();
                                        for (int i = 0; i < sportIdBytes.length; i++) {
                                            if (i > 0) {
                                                hexString.append(" ");
                                            }
                                            hexString.append(String.format("%02X", sportIdBytes[i] & 0xFF));
                                        }
                                        sportData.putString("sportID", hexString.toString());
                                    }

                                    // 运动数据字段 - 与 iOS 字段名和数据类型保持一致
                                    // iOS: steps (NSUInteger)
                                    long stepValue = liveData.getStep();
                                    sportData.putInt("steps", (int) stepValue);

                                    // iOS: calories (NSUInteger)
                                    // 根据 iOS 测试数据：calories: 11，前端使用 (calories / 10) 得到 1.1 kcal
                                    // 说明 iOS 返回的单位是 10 卡（11 * 10 = 110 卡）
                                    // Android SDK 返回的单位是 10 卡（11 * 10 = 110 卡）
                                    float calorieValue = liveData.getCalorie();
                                    int caloriesInUnits = Math.round(calorieValue * 10.0f);
                                    sportData.putInt("calories", caloriesInUnits);

                                    // iOS: distance (NSUInteger)
                                    // 根据 iOS 测试数据：distance: 20，前端使用 (distance / 1000) 得到 0.02 km = 20 米
                                    // 说明 iOS 返回的单位是米（不是文档说的10米）
                                    // Android SDK 返回 float（米），直接转换为整数
                                    float distValue = liveData.getDist();
                                    // 转换为 iOS 格式（米，整数）
                                    int distanceInMeters = Math.round(distValue);
                                    sportData.putInt("distance", distanceInMeters);
                                    sportData.putInt("timeID", (int) liveData.getTime());

                                    sendEvent("sportDataRealTimeUpdate", sportData);
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to parse sport live data: " + e.getMessage());
                                }
                            } else if (sportStatus == 3) {
                                // 设备已停止运动，停止计时器并清理状态
                                // 参考 iOS 和 Android demo 的处理
                                // Log.d(TAG, "Device has stopped the sport");
                                stopSportDataTimer();
                                currentSportId = null;
                                currentSportType = null;
                            }
                        }
                    });
        } catch (Exception e) {
            Log.e(TAG, "Failed to query sport real-time data: " + e.getMessage());
        }
    }

    @ReactMethod
    void queryBluetoothNotification(Callback callback) {
        callback.invoke(true);
    }

    @ReactMethod
    public void checkNotificationListenerPermission(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Set<String> packageNames = NotificationManagerCompat.getEnabledListenerPackages(context);
            boolean isEnabled = packageNames.contains(context.getPackageName());
            promise.resolve(isEnabled);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check notification listener permission", e);
        }
    }

    @ReactMethod
    public void openNotificationSettings(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to open notification settings", e);
        }
    }

    // 在监听到蓝牙开启 调用connect之前添加这个代码
    // SDK 中 userIntercept 为 private；通过官方 setter（Kotlin object → Java 用 INSTANCE）
    @ReactMethod
    public void setUserIntercept(boolean userIntercept) {
        BtHelper.INSTANCE.setUserIntercept(userIntercept);
    }

}
