package com.rentalmanager.app.data.api

import com.rentalmanager.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface RentalApiService {
    
    @GET("/api/properties")
    suspend fun getProperties(): Response<List<Property>>
    
    @GET("/api/properties/{id}")
    suspend fun getProperty(@Path("id") id: String): Response<Property>
    
    @POST("/api/properties")
    suspend fun createProperty(@Body property: Property): Response<Property>
    
    @PUT("/api/properties/{id}")
    suspend fun updateProperty(@Path("id") id: String, @Body property: Property): Response<Property>
    
    @DELETE("/api/properties/{id}")
    suspend fun deleteProperty(@Path("id") id: String): Response<Unit>
    
    @GET("/api/tenants")
    suspend fun getTenants(): Response<List<Tenant>>
    
    @GET("/api/tenants/{id}")
    suspend fun getTenant(@Path("id") id: String): Response<Tenant>
    
    @POST("/api/tenants")
    suspend fun createTenant(@Body tenant: Tenant): Response<Tenant>
    
    @PUT("/api/tenants/{id}")
    suspend fun updateTenant(@Path("id") id: String, @Body tenant: Tenant): Response<Tenant>
    
    @DELETE("/api/tenants/{id}")
    suspend fun deleteTenant(@Path("id") id: String): Response<Unit>
    
    @GET("/api/collections")
    suspend fun getCollections(): Response<List<RentCollection>>
    
    @POST("/api/collections")
    suspend fun createCollection(@Body collection: RentCollection): Response<RentCollection>
    
    @GET("/api/expenses")
    suspend fun getExpenses(): Response<List<Expense>>
    
    @POST("/api/expenses")
    suspend fun createExpense(@Body expense: Expense): Response<Expense>
    
    @GET("/api/dashboard")
    suspend fun getDashboard(): Response<DashboardData>
    
    @GET("/api/predictions")
    suspend fun getPredictions(): Response<PredictionsData>
    
    @GET("/api/ledger")
    suspend fun getLedger(): Response<List<LedgerEntry>>
    
    @POST("/api/ledger")
    suspend fun createLedgerEntry(@Body entry: LedgerEntry): Response<LedgerEntry>
}
