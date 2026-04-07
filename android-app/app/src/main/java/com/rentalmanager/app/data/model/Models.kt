package com.rentalmanager.app.data.model

import com.google.gson.annotations.SerializedName

data class Property(
    val id: String,
    val name: String,
    val address: String,
    val type: String,
    @SerializedName("total_units") val totalUnits: Int,
    @SerializedName("monthly_rent") val monthlyRent: Double,
    val status: String,
    @SerializedName("created_at") val createdAt: String? = null
)

data class Tenant(
    val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    @SerializedName("aadhar_number") val aadharNumber: String? = null,
    @SerializedName("pan_number") val panNumber: String? = null,
    @SerializedName("emergency_contact") val emergencyContact: String? = null,
    @SerializedName("property_id") val propertyId: String,
    @SerializedName("unit_number") val unitNumber: String? = null,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("security_deposit") val securityDeposit: Double? = null,
    val status: String,
    @SerializedName("created_at") val createdAt: String? = null
)

data class RentCollection(
    val id: String,
    @SerializedName("tenant_id") val tenantId: String,
    @SerializedName("property_id") val propertyId: String,
    val amount: Double,
    @SerializedName("payment_date") val paymentDate: String,
    @SerializedName("payment_method") val paymentMethod: String,
    val category: String? = null,
    @SerializedName("month_year") val monthYear: String,
    val status: String,
    val notes: String? = null,
    @SerializedName("reference_number") val referenceNumber: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class Expense(
    val id: String,
    @SerializedName("property_id") val propertyId: String? = null,
    val category: String,
    val description: String,
    val amount: Double,
    @SerializedName("expense_date") val expenseDate: String,
    val vendor: String? = null,
    val status: String,
    @SerializedName("receipt_number") val receiptNumber: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class DashboardStats(
    @SerializedName("totalProperties") val totalProperties: Int,
    @SerializedName("totalTenants") val totalTenants: Int,
    @SerializedName("activeTenants") val activeTenants: Int,
    @SerializedName("monthlyCollection") val monthlyCollection: Double,
    @SerializedName("monthlyExpenses") val monthlyExpenses: Double,
    @SerializedName("netIncome") val netIncome: Double,
    @SerializedName("pendingRent") val pendingRent: Int
)

data class DashboardData(
    val stats: DashboardStats,
    @SerializedName("recentCollections") val recentCollections: List<RentCollectionWithNames>,
    @SerializedName("recentExpenses") val recentExpenses: List<ExpenseWithName>,
    @SerializedName("monthlyTrend") val monthlyTrend: List<MonthlyData>
)

data class RentCollectionWithNames(
    val id: String,
    @SerializedName("tenant_name") val tenantName: String,
    @SerializedName("property_name") val propertyName: String,
    @SerializedName("month_year") val monthYear: String,
    @SerializedName("payment_method") val paymentMethod: String,
    val amount: Double,
    val status: String
)

data class ExpenseWithName(
    val id: String,
    val description: String,
    @SerializedName("property_name") val propertyName: String?,
    @SerializedName("expense_date") val expenseDate: String,
    val amount: Double
)

data class MonthlyData(
    val month: String,
    val amount: Double
)

data class PredictionSummary(
    @SerializedName("activeTenants") val activeTenants: Int,
    @SerializedName("projectedMonthlyIncome") val projectedMonthlyIncome: Double,
    @SerializedName("averageCollectionRate") val averageCollectionRate: Double,
    @SerializedName("monthsOfHistory") val monthsOfHistory: Int
)

data class Forecast(
    val month: String,
    val year: Int,
    @SerializedName("predictedIncome") val predictedIncome: Int,
    @SerializedName("predictedExpenses") val predictedExpenses: Int,
    @SerializedName("predictedNet") val predictedNet: Int,
    val confidence: String
)

data class PredictionsData(
    val summary: PredictionSummary,
    val forecast: List<Forecast>,
    @SerializedName("propertyPredictions") val propertyPredictions: List<PropertyPrediction>,
    @SerializedName("yearEndProjections") val yearEndProjections: YearEndProjections,
    val risks: Risks,
    val recommendations: List<Recommendation>
)

data class PropertyPrediction(
    val id: String,
    val name: String,
    val type: String,
    @SerializedName("totalUnits") val totalUnits: Int,
    @SerializedName("occupiedUnits") val occupiedUnits: Int,
    @SerializedName("occupancyRate") val occupancyRate: Double,
    @SerializedName("monthlyRent") val monthlyRent: Double,
    @SerializedName("projectedMonthlyIncome") val projectedMonthlyIncome: Double,
    @SerializedName("vacancyRisk") val vacancyRisk: String
)

data class YearEndProjections(
    @SerializedName("projectedTotalIncome") val projectedTotalIncome: Int,
    @SerializedName("projectedTotalExpenses") val projectedTotalExpenses: Int,
    @SerializedName("projectedNetIncome") val projectedNetIncome: Int,
    @SerializedName("currentYearActuals") val currentYearActuals: CurrentYearActuals
)

data class CurrentYearActuals(
    val income: Double,
    val expenses: Double
)

data class Risks(
    @SerializedName("latePayments") val latePayments: Int,
    @SerializedName("expiringLeases") val expiringLeases: Int,
    @SerializedName("expenseAlerts") val expenseAlerts: List<ExpenseAlert>?
)

data class ExpenseAlert(
    val category: String,
    val total: Double,
    val avg: Double
)

data class Recommendation(
    val type: String,
    val priority: String,
    val message: String
)

data class LedgerEntry(
    val id: String,
    @SerializedName("entry_date") val entryDate: String,
    @SerializedName("entry_type") val entryType: String,
    val category: String,
    val description: String,
    val amount: Double,
    @SerializedName("gst_amount") val gstAmount: Double? = null,
    @SerializedName("tds_amount") val tdsAmount: Double? = null,
    @SerializedName("net_amount") val netAmount: Double? = null,
    @SerializedName("reference_id") val referenceId: String? = null,
    @SerializedName("reference_type") val referenceType: String? = null,
    @SerializedName("property_id") val propertyId: String? = null,
    @SerializedName("tenant_id") val tenantId: String? = null,
    val vendor: String? = null,
    @SerializedName("pan_number") val panNumber: String? = null,
    @SerializedName("gst_number") val gstNumber: String? = null,
    @SerializedName("fy_year") val fyYear: String? = null,
    val quarter: String? = null,
    val notes: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)
