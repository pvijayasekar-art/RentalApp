package com.rentalmanager.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.rentalmanager.app.data.model.Forecast
import com.rentalmanager.app.data.model.PropertyPrediction
import com.rentalmanager.app.data.model.Recommendation
import com.rentalmanager.app.ui.theme.*
import com.rentalmanager.app.ui.viewmodel.PredictionsUiState
import com.rentalmanager.app.ui.viewmodel.PredictionsViewModel
import java.text.NumberFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PredictionsScreen(
    viewModel: PredictionsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Forecast & Predictions") },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is PredictionsUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is PredictionsUiState.Error -> {
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
            is PredictionsUiState.Success -> {
                PredictionsContent(
                    predictions = state.predictions,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@Composable
private fun PredictionsContent(
    predictions: com.rentalmanager.app.data.model.PredictionsData,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Summary",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        SummaryItem(
                            label = "Active Tenants",
                            value = predictions.summary.activeTenants.toString(),
                            color = PrimaryBlue
                        )
                        SummaryItem(
                            label = "Projected Income",
                            value = currencyFormatter.format(predictions.summary.projectedMonthlyIncome),
                            color = SuccessGreen
                        )
                        SummaryItem(
                            label = "Collection Rate",
                            value = "${predictions.summary.averageCollectionRate.toInt()}%",
                            color = PurpleAccent
                        )
                    }
                }
            }
        }

        if (predictions.forecast.isNotEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "3-Month Forecast",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        predictions.forecast.forEach { forecast ->
                            ForecastRow(forecast = forecast, currencyFormatter = currencyFormatter)
                            if (forecast != predictions.forecast.last()) {
                                Divider(modifier = Modifier.padding(vertical = 8.dp))
                            }
                        }
                    }
                }
            }
        }

        if (predictions.propertyPredictions.isNotEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Property Predictions",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        predictions.propertyPredictions.take(3).forEach { property ->
                            PropertyPredictionRow(
                                property = property,
                                currencyFormatter = currencyFormatter
                            )
                            if (property != predictions.propertyPredictions.take(3).last()) {
                                Divider(modifier = Modifier.padding(vertical = 8.dp))
                            }
                        }
                    }
                }
            }
        }

        if (predictions.recommendations.isNotEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Recommendations",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        predictions.recommendations.forEach { recommendation ->
                            RecommendationRow(recommendation = recommendation)
                            if (recommendation != predictions.recommendations.last()) {
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryItem(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ForecastRow(
    forecast: Forecast,
    currencyFormatter: NumberFormat
) {
    val confidenceColor = when (forecast.confidence) {
        "high" -> SuccessGreen
        "medium" -> YellowWarning
        else -> ErrorRed
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "${forecast.month} ${forecast.year}",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "Net: ${currencyFormatter.format(forecast.predictedNet)}",
                style = MaterialTheme.typography.bodySmall,
                color = if (forecast.predictedNet >= 0) SuccessGreen else ErrorRed
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = currencyFormatter.format(forecast.predictedIncome.toDouble()),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = SuccessGreen
            )
            Text(
                text = "-${currencyFormatter.format(forecast.predictedExpenses.toDouble())}",
                style = MaterialTheme.typography.bodySmall,
                color = ErrorRed
            )
            Box(
                modifier = Modifier
                    .background(confidenceColor.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Text(
                    text = forecast.confidence.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = confidenceColor,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun PropertyPredictionRow(
    property: PropertyPrediction,
    currencyFormatter: NumberFormat
) {
    val occupancyColor = when {
        property.occupancyRate >= 80 -> SuccessGreen
        property.occupancyRate >= 50 -> YellowWarning
        else -> ErrorRed
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = property.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "${property.occupiedUnits}/${property.totalUnits} units occupied",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = currencyFormatter.format(property.projectedMonthlyIncome),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "${property.occupancyRate.toInt()}% occupied",
                style = MaterialTheme.typography.labelSmall,
                color = occupancyColor
            )
        }
    }
}

@Composable
private fun RecommendationRow(recommendation: Recommendation) {
    val (backgroundColor, textColor) = when (recommendation.type) {
        "success" -> Pair(SuccessGreen.copy(alpha = 0.1f), SuccessGreen)
        "warning" -> Pair(YellowWarning.copy(alpha = 0.1f), YellowWarning)
        "error" -> Pair(ErrorRed.copy(alpha = 0.1f), ErrorRed)
        "action" -> Pair(PrimaryBlue.copy(alpha = 0.1f), PrimaryBlue)
        else -> Pair(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
    }

    val icon = when (recommendation.type) {
        "success" -> Icons.Default.CheckCircle
        "warning" -> Icons.Default.Warning
        "error" -> Icons.Default.Error
        "action" -> Icons.Default.ArrowForward
        else -> Icons.Default.Info
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = recommendation.message,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor,
                modifier = Modifier.weight(1f)
            )
        }
    }
}
