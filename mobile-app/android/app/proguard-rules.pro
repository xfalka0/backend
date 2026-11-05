# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.

# React Native & Hermes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo Modules
-keep class expo.modules.** { *; }
-keep class expo.modules.core.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# React Native Screens & Gesture Handler
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# React Native SVG
-keep class com.horcrux.svg.** { *; }

# React Native Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Agora SDK
-keep class io.agora.** { *; }
-keep class io.agora.rtc2.** { *; }

# RevenueCat Purchases
-keep class com.revenuecat.purchases.** { *; }

# Lottie
-keep class com.airbnb.lottie.** { *; }

# Firebase & Google Play Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Facebook SDK
-keep class com.facebook.** { *; }

# Suppress harmless warnings during shrinking
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**
