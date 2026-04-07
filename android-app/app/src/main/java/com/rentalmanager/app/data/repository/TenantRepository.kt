package com.rentalmanager.app.data.repository

import com.rentalmanager.app.data.api.RentalApiService
import com.rentalmanager.app.data.model.Tenant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TenantRepository @Inject constructor(
    private val apiService: RentalApiService
) {
    suspend fun getTenants(): Result<List<Tenant>> {
        return try {
            val response = apiService.getTenants()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load tenants: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getTenant(id: String): Result<Tenant> {
        return try {
            val response = apiService.getTenant(id)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Tenant not found"))
            } else {
                Result.failure(Exception("Failed to load tenant: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createTenant(tenant: Tenant): Result<Tenant> {
        return try {
            val response = apiService.createTenant(tenant)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create tenant"))
            } else {
                Result.failure(Exception("Failed to create tenant: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateTenant(id: String, tenant: Tenant): Result<Tenant> {
        return try {
            val response = apiService.updateTenant(id, tenant)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to update tenant"))
            } else {
                Result.failure(Exception("Failed to update tenant: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteTenant(id: String): Result<Unit> {
        return try {
            val response = apiService.deleteTenant(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete tenant: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
