package com.rentalmanager.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.rentalmanager.app.data.model.RentCollectionWithNames
import com.rentalmanager.app.data.model.DashboardData
import com.rentalmanager.app.data.model.ExpenseWithName
import com.rentalmanager.app.data.model.MonthlyData
import com.rentalmanager.app.ui.theme.*
import com.rentalmanager.app.ui.viewmodel.DashboardUiState
import com.rentalmanager.app.ui.viewmodel.DashboardViewModel
import java.text.NumberFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToProperties: () -> Unit,
    onNavigateToCollections: () -> Unit,
    onNavigateToExpenses: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dashboard") },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is DashboardUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is DashboardUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Button(onClick = { viewModel.refresh() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is DashboardUiState.Success -> {
                DashboardContent(
                    data = state.data,
                    modifier = Modifier.padding(paddingValues),
                    onNavigateToProperties = onNavigateToProperties,
                    onNavigateToCollections = onNavigateToCollections,
                    onNavigateToExpenses = onNavigateToExpenses
                )
            }
        }
    }
}

@Composable
private fun DashboardContent(
    data: DashboardData,
    modifier: Modifier = Modifier,
    onNavigateToProperties: () -> Unit,
    onNavigateToCollections: () -> Unit,
    onNavigateToExpenses: () -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Overview",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        item {
            StatsGrid(
                stats = data.stats,
                onNavigateToProperties = onNavigateToProperties,
                onNavigateToCollections = onNavigateToCollections,
                onNavigateToExpenses = onNavigateToExpenses
            )
        }

        item {
            MonthlyTrendChart(
                trendData = data.monthlyTrend,
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (data.recentCollections.isNotEmpty()) {
            item {
                RecentCollectionsSection(
                    collections = data.recentCollections,
                    onNavigateToCollections = onNavigateToCollections
                )
            }
        }

        if (data.recentExpenses.isNotEmpty()) {
            item {
                RecentExpensesSection(
                    expenses = data.recentExpenses,
                    onNavigateToExpenses = onNavigateToExpenses
                )
            }
        }
    }
}

@Composable
private fun StatsGrid(
    stats: com.rentalmanager.app.data.model.DashboardStats,
    onNavigateToProperties: () -> Unit,
    onNavigateToCollections: () -> Unit,
    onNavigateToExpenses: () -> Unit
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "Properties",
                value = stats.totalProperties.toString(),
                icon = Icons.Default.Business,
                color = PrimaryBlue,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToProperties
            )
            StatCard(
                title = "Tenants",
                value = "${stats.activeTenants}/${stats.totalTenants}",
                icon = Icons.Default.People,
                color = SuccessGreen,
                modifier = Modifier.weight(1f),
                onClick = { }
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "This Month",
                value = currencyFormatter.format(stats.monthlyCollection),
                icon = Icons.Default.Payment,
                color = WarningOrange,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToCollections
            )
            StatCard(
                title = "Expenses",
                value = currencyFormatter.format(stats.monthlyExpenses),
                icon = Icons.Default.Receipt,
                color = ErrorRed,
                modifier = Modifier.weight(1f),
                onClick = onNavigateToExpenses
            )
        }

        StatCard(
            title = "Net Income",
            value = currencyFormatter.format(stats.netIncome),
            subtitle = "${stats.pendingRent} pending payments",
            icon = Icons.Default.TrendingUp,
            color = PurpleAccent,
            modifier = Modifier.fillMaxWidth(),
            onClick = { }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatCard(
    title: String,
    value: String,
    subtitle: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(color.copy(alpha = 0.2f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                }
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = YellowWarning
                )
            }
        }
    }
}

@Composable
private fun MonthlyTrendChart(
    trendData: List<MonthlyData>,
    modifier: Modifier = Modifier
) {
    if (trendData.isEmpty()) return

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Collection Trend",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            SimpleBarChart(data = trendData)
        }
    }
}

@Composable
private fun SimpleBarChart(data: List<MonthlyData>) {
    val maxValue = data.maxOfOrNull { it.amount } ?: 1.0
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.Bottom
    ) {
        data.forEach { monthData ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val heightFraction = if (maxValue > 0) (monthData.amount / maxValue).toFloat() else 0f

                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .fillMaxHeight(heightFraction.coerceIn(0.1f, 1f))
                        .background(PrimaryBlue, RoundedCornerShape(4.dp))
                )

                Text(
                    text = monthData.month.substring(0, 3),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = formatCompactCurrency(monthData.amount),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun formatCompactCurrency(amount: Double): String {
    return when {
        amount >= 100000 -> "${(amount / 100000).toInt()}L"
        amount >= 1000 -> "${(amount / 1000).toInt()}K"
        else -> amount.toInt().toString()
    }
}

@Composable
private fun RecentCollectionsSection(
    collections: List<RentCollectionWithNames>,
    onNavigateToCollections: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Recent Collections",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                TextButton(onClick = onNavigateToCollections) {
                    Text("View All")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            collections.take(5).forEach { collection ->
                CollectionRow(collection = collection)
                if (collection != collections.take(5).last()) {
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                }
            }
        }
    }
}

@Composable
private fun CollectionRow(collection: RentCollectionWithNames) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = collection.tenantName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "${collection.propertyName} • ${collection.monthYear}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = currencyFormatter.format(collection.amount),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = SuccessGreen
            )
            StatusBadge(status = collection.status)
        }
    }
}

@Composable
private fun RecentExpensesSection(
    expenses: List<ExpenseWithName>,
    onNavigateToExpenses: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Recent Expenses",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                TextButton(onClick = onNavigateToExpenses) {
                    Text("View All")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            expenses.take(5).forEach { expense ->
                ExpenseRow(expense = expense)
                if (expense != expenses.take(5).last()) {
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                }
            }
        }
    }
}

@Composable
private fun ExpenseRow(expense: ExpenseWithName) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = expense.description.take(30) + if (expense.description.length > 30) "..." else "",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "${expense.propertyName ?: "General"} • ${expense.expenseDate}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Text(
            text = currencyFormatter.format(expense.amount),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = ErrorRed
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, backgroundColor) = when (status.lowercase()) {
        "paid" -> Pair(SuccessGreen, SuccessGreen.copy(alpha = 0.2f))
        "pending" -> Pair(YellowWarning, YellowWarning.copy(alpha = 0.2f))
        "overdue" -> Pair(ErrorRed, ErrorRed.copy(alpha = 0.2f))
        else -> Pair(MaterialTheme.colorScheme.onSurfaceVariant, MaterialTheme.colorScheme.surfaceVariant)
    }

    Box(
        modifier = Modifier
            .background(backgroundColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Medium
        )
    }
}
