package com.rentalmanager.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rentalmanager.app.data.model.Property
import com.rentalmanager.app.data.repository.PropertyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PropertiesViewModel @Inject constructor(
    private val propertyRepository: PropertyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PropertiesUiState>(PropertiesUiState.Loading)
    val uiState: StateFlow<PropertiesUiState> = _uiState.asStateFlow()

    init {
        loadProperties()
    }

    fun loadProperties() {
        viewModelScope.launch {
            _uiState.value = PropertiesUiState.Loading
            propertyRepository.getProperties()
                .onSuccess { properties ->
                    _uiState.value = PropertiesUiState.Success(properties)
                }
                .onFailure { error ->
                    _uiState.value = PropertiesUiState.Error(error.message ?: "Failed to load properties")
                }
        }
    }

    fun refresh() {
        loadProperties()
    }

    fun deleteProperty(id: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            propertyRepository.deleteProperty(id)
                .onSuccess {
                    loadProperties()
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = PropertiesUiState.Error(error.message ?: "Failed to delete property")
                }
        }
    }
}

sealed class PropertiesUiState {
    object Loading : PropertiesUiState()
    data class Success(val properties: List<Property>) : PropertiesUiState()
    data class Error(val message: String) : PropertiesUiState()
}

@HiltViewModel
class PropertyDetailViewModel @Inject constructor(
    private val propertyRepository: PropertyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PropertyDetailUiState>(PropertyDetailUiState.Loading)
    val uiState: StateFlow<PropertyDetailUiState> = _uiState.asStateFlow()

    fun loadProperty(id: String) {
        viewModelScope.launch {
            _uiState.value = PropertyDetailUiState.Loading
            propertyRepository.getProperty(id)
                .onSuccess { property ->
                    _uiState.value = PropertyDetailUiState.Success(property)
                }
                .onFailure { error ->
                    _uiState.value = PropertyDetailUiState.Error(error.message ?: "Failed to load property")
                }
        }
    }

    fun saveProperty(property: Property, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            if (property.id.isEmpty()) {
                propertyRepository.createProperty(property)
            } else {
                propertyRepository.updateProperty(property.id, property)
            }
                .onSuccess {
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = PropertyDetailUiState.Error(error.message ?: "Failed to save property")
                }
        }
    }
}

sealed class PropertyDetailUiState {
    object Loading : PropertyDetailUiState()
    data class Success(val property: Property) : PropertyDetailUiState()
    data class Error(val message: String) : PropertyDetailUiState()
}
