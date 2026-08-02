package io.kindbrave.ollamaserver.reactpkg;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import io.kindbrave.ollamaserver.module.ClipboardModule;
import io.kindbrave.ollamaserver.module.FileUploadModule;
import io.kindbrave.ollamaserver.module.HashModule;
import io.kindbrave.ollamaserver.module.LogSaveModule;
import io.kindbrave.ollamaserver.module.OllamaConfigModule;
import io.kindbrave.ollamaserver.module.OllamaServiceModule;

public class AppReactPackage implements ReactPackage {
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(
            @NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new OllamaServiceModule(reactContext));
        modules.add(new OllamaConfigModule(reactContext));
        modules.add(new FileUploadModule(reactContext));
        modules.add(new HashModule(reactContext));
        modules.add(new LogSaveModule(reactContext));
        modules.add(new ClipboardModule(reactContext));
        return modules;
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(
            @NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
