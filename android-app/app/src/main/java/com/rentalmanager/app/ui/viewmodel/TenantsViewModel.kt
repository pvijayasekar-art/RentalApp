package com.rentalmanager.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rentalmanager.app.data.model.Tenant
import com.rentalmanager.app.data.repository.TenantRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TenantsViewModel @Inject constructor(
    private val tenantRepository: TenantRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<TenantsUiState>(TenantsUiState.Loading)
    val uiState: StateFlow<TenantsUiState> = _uiState.asStateFlow()

    init {
        loadTenants()
    }

    fun loadTenants() {
        viewModelScope.launch {
            _uiState.value = TenantsUiState.Loading
            tenantRepository.getTenants()
                .onSuccess { tenants ->
                    _uiState.value = TenantsUiState.Success(tenants)
                }
                .onFailure { error ->
                    _uiState.value = TenantsUiState.Error(error.message ?: "Failed to load tenants")
                }
        }
    }

    fun refresh() {
        loadTenants()
    }

    fun deleteTenant(id: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            tenantRepository.deleteTenant(id)
                .onSuccess {
                    loadTenants()
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = TenantsUiState.Error(error.message ?: "Failed to delete tenant")
                }
        }
    }
}

sealed class TenantsUiState {
    object Loading : TenantsUiState()
    data class Success(val tenants: List<Tenant>) : TenantsUiState()
    data class Error(val message: String) : TenantsUiState()
}

@HiltViewModel
class TenantDetailViewModel @Inject constructor(
    private val tenantRepository: TenantRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<TenantDetailUiState>(TenantDetailUiState.Loading)
    val uiState: StateFlow<TenantDetailUiState> = _uiState.asStateFlow()

    fun loadTenant(id: String) {
        viewModelScope.launch {
            _uiState.value = TenantDetailUiState.Loading
            tenantRepository.getTenant(id)
                .onSuccess { tenant ->
                    _uiState.value = TenantDetailUiState.Success(tenant)
                }
                .onFailure { error ->
                    _uiState.value = TenantDetailUiState.Error(error.message ?: "Failed to load tenant")
                }
        }
    }

    fun saveTenant(tenant: Tenant, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            if (tenant.id.isEmpty()) {
                tenantRepository.createTenant(tenant)
            } else {
                tenantRepository.updateTenant(tenant.id, tenant)
            }
                .onSuccess {
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = TenantDetailUiState.Error(error.message ?: "Failed to save tenant")
                }
        }
    }
}

sealed class TenantDetailUiState {
    object Loading : TenantDetailUiState()
    data class Success(val tenant: Tenant) : TenantDetailUiState()
    data class Error(val message: String) : TenantDetailUiState()
}
