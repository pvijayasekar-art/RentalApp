package com.rentalmanager.app.data.repository

import com.rentalmanager.app.data.api.RentalApiService
import com.rentalmanager.app.data.model.RentCollection
import com.rentalmanager.app.data.model.DashboardData
import com.rentalmanager.app.data.model.Expense
import com.rentalmanager.app.data.model.LedgerEntry
import com.rentalmanager.app.data.model.PredictionsData
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DashboardRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getDashboardData(): Result<DashboardData> {
        return try {
            val response = apiService.getDashboard()
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("No dashboard data"))
            } else {
                Result.failure(Exception("Failed to load dashboard: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

@Singleton
class CollectionRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getCollections(): Result<List<RentCollection>> {
        return try {
            val response = apiService.getCollections()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load collections: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createCollection(collection: RentCollection): Result<RentCollection> {
        return try {
            val response = apiService.createCollection(collection)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create collection"))
            } else {
                Result.failure(Exception("Failed to create collection: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

@Singleton
class ExpenseRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getExpenses(): Result<List<Expense>> {
        return try {
            val response = apiService.getExpenses()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load expenses: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createExpense(expense: Expense): Result<Expense> {
        return try {
            val response = apiService.createExpense(expense)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create expense"))
            } else {
                Result.failure(Exception("Failed to create expense: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

@Singleton
class PredictionRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getPredictions(): Result<PredictionsData> {
        return try {
            val response = apiService.getPredictions()
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("No prediction data"))
            } else {
                Result.failure(Exception("Failed to load predictions: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

@Singleton
class LedgerRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getLedgerEntries(): Result<List<LedgerEntry>> {
        return try {
            val response = apiService.getLedger()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load ledger: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createEntry(entry: LedgerEntry): Result<LedgerEntry> {
        return try {
            val response = apiService.createLedgerEntry(entry)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create entry"))
            } else {
                Result.failure(Exception("Failed to create entry: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
