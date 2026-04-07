package com.rentalmanager.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState

@Composable
fun BottomNavBar(navController: NavController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    
    NavigationBar {
        bottomNavItems.forEach { screen ->
            val selected = currentRoute == screen.route
            val icon = getIconForScreen(screen.icon, selected)
            
            NavigationBarItem(
                icon = { Icon(icon, contentDescription = screen.title) },
                label = { 
                    Text(
                        text = screen.title,
                        maxLines = 1,
                        softWrap = false
                    )
                },
                selected = selected,
                onClick = {
                    if (currentRoute != screen.route) {
                        navController.navigate(screen.route) {
                            popUpTo(navController.graph.startDestinationId) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                alwaysShowLabel = false
            )
        }
    }
}

private fun getIconForScreen(iconName: String, selected: Boolean): ImageVector {
    return when (iconName) {
        "dashboard" -> if (selected) Icons.Filled.Dashboard else Icons.Outlined.Dashboard
        "building" -> if (selected) Icons.Filled.Business else Icons.Outlined.Business
        "people" -> if (selected) Icons.Filled.People else Icons.Outlined.People
        "payments" -> if (selected) Icons.Filled.Payment else Icons.Outlined.Payment
        "receipt" -> if (selected) Icons.Filled.Receipt else Icons.Outlined.Receipt
        "trending_up" -> if (selected) Icons.Filled.TrendingUp else Icons.Outlined.TrendingUp
        "account_balance" -> if (selected) Icons.Filled.AccountBalance else Icons.Outlined.AccountBalance
        else -> Icons.Default.Help
    }
}
