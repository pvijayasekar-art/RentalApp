package com.rentalmanager.app.data.repository

import com.rentalmanager.app.data.api.RentalApiService
import com.rentalmanager.app.data.model.DashboardData
import com.rentalmanager.app.data.model.Property
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PropertyRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getProperties(): Result<List<Property>> {
        return try {
            val response = apiService.getProperties()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load properties: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getProperty(id: String): Result<Property> {
        return try {
            val response = apiService.getProperty(id)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Property not found"))
            } else {
                Result.failure(Exception("Failed to load property: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createProperty(property: Property): Result<Property> {
        return try {
            val response = apiService.createProperty(property)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create property"))
            } else {
                Result.failure(Exception("Failed to create property: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateProperty(id: String, property: Property): Result<Property> {
        return try {
            val response = apiService.updateProperty(id, property)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to update property"))
            } else {
                Result.failure(Exception("Failed to update property: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteProperty(id: String): Result<Unit> {
        return try {
            val response = apiService.deleteProperty(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete property: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
