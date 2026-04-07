package com.rentalmanager.app.di

import com.rentalmanager.app.data.api.RentalApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    // NOTE: Update this URL for your backend server
    // For Android Emulator: use "http://10.0.2.2:5000" (emulator localhost)
    // For Physical Device: use "http://YOUR_COMPUTER_IP:5000" (same WiFi network)
    private const val BASE_URL = "http://10.0.2.2:5000"
    
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        
        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRentalApiService(retrofit: Retrofit): RentalApiService {
        return retrofit.create(RentalApiService::class.java)
    }
}
