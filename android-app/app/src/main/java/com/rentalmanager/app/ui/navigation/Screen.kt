package com.rentalmanager.app.ui.navigation

sealed class Screen(val route: String, val title: String, val icon: String) {
    object Dashboard : Screen("dashboard", "Dashboard", "dashboard")
    object Properties : Screen("properties", "Properties", "building")
    object Tenants : Screen("tenants", "Tenants", "people")
    object Collections : Screen("collections", "Collections", "payments")
    object Expenses : Screen("expenses", "Expenses", "receipt")
    object Predictions : Screen("predictions", "Forecast", "trending_up")
    object Ledger : Screen("ledger", "Ledger", "account_balance")
    
    object PropertyDetail : Screen("property_detail/{propertyId}", "Property Detail", "building") {
        fun createRoute(propertyId: String) = "property_detail/$propertyId"
    }
    
    object TenantDetail : Screen("tenant_detail/{tenantId}", "Tenant Detail", "people") {
        fun createRoute(tenantId: String) = "tenant_detail/$tenantId"
    }
    
    object AddProperty : Screen("add_property", "Add Property", "add")
    object AddTenant : Screen("add_tenant", "Add Tenant", "add")
    object AddCollection : Screen("add_collection", "Add Collection", "add")
    object AddExpense : Screen("add_expense", "Add Expense", "add")
}

val bottomNavItems = listOf(
    Screen.Dashboard,
    Screen.Properties,
    Screen.Tenants,
    Screen.Collections,
    Screen.Predictions
)
