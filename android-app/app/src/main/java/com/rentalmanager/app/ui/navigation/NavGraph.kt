package com.rentalmanager.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.rentalmanager.app.ui.screens.*

@Composable
fun NavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier
    ) {
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToProperties = { navController.navigate(Screen.Properties.route) },
                onNavigateToCollections = { navController.navigate(Screen.Collections.route) },
                onNavigateToExpenses = { navController.navigate(Screen.Expenses.route) }
            )
        }
        
        composable(Screen.Properties.route) {
            PropertiesScreen(
                onPropertyClick = { propertyId ->
                    navController.navigate(Screen.PropertyDetail.createRoute(propertyId))
                },
                onAddProperty = {
                    navController.navigate(Screen.AddProperty.route)
                }
            )
        }
        
        composable(
            route = Screen.PropertyDetail.route,
            arguments = listOf(navArgument("propertyId") { type = NavType.StringType })
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId") ?: ""
            PropertyDetailScreen(
                propertyId = propertyId,
                onBackClick = { navController.popBackStack() }
            )
        }
        
        composable(Screen.AddProperty.route) {
            AddPropertyScreen(
                onBackClick = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }
        
        composable(Screen.Tenants.route) {
            TenantsScreen(
                onTenantClick = { tenantId ->
                    navController.navigate(Screen.TenantDetail.createRoute(tenantId))
                },
                onAddTenant = {
                    navController.navigate(Screen.AddTenant.route)
                }
            )
        }
        
        composable(
            route = Screen.TenantDetail.route,
            arguments = listOf(navArgument("tenantId") { type = NavType.StringType })
        ) { backStackEntry ->
            val tenantId = backStackEntry.arguments?.getString("tenantId") ?: ""
            TenantDetailScreen(
                tenantId = tenantId,
                onBackClick = { navController.popBackStack() }
            )
        }
        
        composable(Screen.AddTenant.route) {
            AddTenantScreen(
                onBackClick = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }
        
        composable(Screen.Collections.route) {
            CollectionsScreen(
                onAddCollection = {
                    navController.navigate(Screen.AddCollection.route)
                }
            )
        }
        
        composable(Screen.AddCollection.route) {
            AddCollectionScreen(
                onBackClick = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }
        
        composable(Screen.Expenses.route) {
            ExpensesScreen(
                onAddExpense = {
                    navController.navigate(Screen.AddExpense.route)
                }
            )
        }
        
        composable(Screen.AddExpense.route) {
            AddExpenseScreen(
                onBackClick = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }
        
        composable(Screen.Predictions.route) {
            PredictionsScreen()
        }
        
        composable(Screen.Ledger.route) {
            LedgerScreen()
        }
    }
}
