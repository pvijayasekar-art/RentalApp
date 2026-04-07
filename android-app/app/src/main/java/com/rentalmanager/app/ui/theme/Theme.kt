package com.rentalmanager.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryBlue,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = PrimaryBlue.copy(alpha = 0.2f),
    onPrimaryContainer = PrimaryBlue,
    secondary = SuccessGreen,
    onSecondary = androidx.compose.ui.graphics.Color.White,
    secondaryContainer = SuccessGreen.copy(alpha = 0.2f),
    onSecondaryContainer = SuccessGreen,
    tertiary = PurpleAccent,
    onTertiary = androidx.compose.ui.graphics.Color.White,
    tertiaryContainer = PurpleAccent.copy(alpha = 0.2f),
    onTertiaryContainer = PurpleAccent,
    error = ErrorRed,
    onError = androidx.compose.ui.graphics.Color.White,
    errorContainer = ErrorRed.copy(alpha = 0.2f),
    onErrorContainer = ErrorRed,
    background = DarkBackground,
    onBackground = androidx.compose.ui.graphics.Color.White,
    surface = DarkSurface,
    onSurface = androidx.compose.ui.graphics.Color.White,
    surfaceVariant = DarkCard,
    onSurfaceVariant = androidx.compose.ui.graphics.Color.LightGray,
    outline = DarkBorder,
    outlineVariant = DarkBorder.copy(alpha = 0.5f)
)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryBlue,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = PrimaryBlue.copy(alpha = 0.1f),
    onPrimaryContainer = PrimaryBlue,
    secondary = SuccessGreen,
    onSecondary = androidx.compose.ui.graphics.Color.White,
    secondaryContainer = SuccessGreen.copy(alpha = 0.1f),
    onSecondaryContainer = SuccessGreen,
    tertiary = PurpleAccent,
    onTertiary = androidx.compose.ui.graphics.Color.White,
    tertiaryContainer = PurpleAccent.copy(alpha = 0.1f),
    onTertiaryContainer = PurpleAccent,
    error = ErrorRed,
    onError = androidx.compose.ui.graphics.Color.White,
    errorContainer = ErrorRed.copy(alpha = 0.1f),
    onErrorContainer = ErrorRed,
    background = LightBackground,
    onBackground = LightText,
    surface = LightSurface,
    onSurface = LightText,
    surfaceVariant = LightCard,
    onSurfaceVariant = LightMuted,
    outline = LightBorder,
    outlineVariant = LightBorder.copy(alpha = 0.5f)
)

@Composable
fun RentalManagerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
