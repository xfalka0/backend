package com.fivachat.app

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.widget.EditText
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * This package clears the native Android EditText background drawable
 * that causes a dark horizontal strip inside TextInput on Android.
 * 
 * React Native's TextInput renders to a native ReactEditText (subclass of EditText).
 * Android's material theme sets an editTextBackground drawable that draws a dark
 * tinted background when focused. Setting it to @null in styles.xml is not always
 * enough — this package overrides it at the view level for every EditText rendered.
 */
class ClearInputBackgroundPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return emptyList()
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
