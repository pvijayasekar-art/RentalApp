package com.rentalmanager.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rentalmanager.app.data.model.RentCollection
import com.rentalmanager.app.data.model.Expense
import com.rentalmanager.app.data.model.LedgerEntry
import com.rentalmanager.app.data.model.PredictionsData
import com.rentalmanager.app.data.repository.CollectionRepository
import com.rentalmanager.app.data.repository.ExpenseRepository
import com.rentalmanager.app.data.repository.LedgerRepository
import com.rentalmanager.app.data.repository.PredictionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CollectionsViewModel @Inject constructor(
    private val collectionRepository: CollectionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CollectionsUiState>(CollectionsUiState.Loading)
    val uiState: StateFlow<CollectionsUiState> = _uiState.asStateFlow()

    init {
        loadCollections()
    }

    fun loadCollections() {
        viewModelScope.launch {
            _uiState.value = CollectionsUiState.Loading
            collectionRepository.getCollections()
                .onSuccess { collections ->
                    _uiState.value = CollectionsUiState.Success(collections.sortedByDescending { it.paymentDate })
                }
                .onFailure { error ->
                    _uiState.value = CollectionsUiState.Error(error.message ?: "Failed to load collections")
                }
        }
    }

    fun refresh() {
        loadCollections()
    }

    fun addCollection(collection: RentCollection, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            collectionRepository.createCollection(collection)
                .onSuccess {
                    loadCollections()
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = CollectionsUiState.Error(error.message ?: "Failed to add collection")
                }
        }
    }
}

sealed class CollectionsUiState {
    object Loading : CollectionsUiState()
    data class Success(val collections: List<RentCollection>) : CollectionsUiState()
    data class Error(val message: String) : CollectionsUiState()
}

@HiltViewModel
class ExpensesViewModel @Inject constructor(
    private val expenseRepository: ExpenseRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ExpensesUiState>(ExpensesUiState.Loading)
    val uiState: StateFlow<ExpensesUiState> = _uiState.asStateFlow()

    init {
        loadExpenses()
    }

    fun loadExpenses() {
        viewModelScope.launch {
            _uiState.value = ExpensesUiState.Loading
            expenseRepository.getExpenses()
                .onSuccess { expenses ->
                    _uiState.value = ExpensesUiState.Success(expenses.sortedByDescending { it.expenseDate })
                }
                .onFailure { error ->
                    _uiState.value = ExpensesUiState.Error(error.message ?: "Failed to load expenses")
                }
        }
    }

    fun refresh() {
        loadExpenses()
    }

    fun addExpense(expense: Expense, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            expenseRepository.createExpense(expense)
                .onSuccess {
                    loadExpenses()
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = ExpensesUiState.Error(error.message ?: "Failed to add expense")
                }
        }
    }
}

sealed class ExpensesUiState {
    object Loading : ExpensesUiState()
    data class Success(val expenses: List<Expense>) : ExpensesUiState()
    data class Error(val message: String) : ExpensesUiState()
}

@HiltViewModel
class PredictionsViewModel @Inject constructor(
    private val predictionRepository: PredictionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PredictionsUiState>(PredictionsUiState.Loading)
    val uiState: StateFlow<PredictionsUiState> = _uiState.asStateFlow()

    init {
        loadPredictions()
    }

    fun loadPredictions() {
        viewModelScope.launch {
            _uiState.value = PredictionsUiState.Loading
            predictionRepository.getPredictions()
                .onSuccess { predictions ->
                    _uiState.value = PredictionsUiState.Success(predictions)
                }
                .onFailure { error ->
                    _uiState.value = PredictionsUiState.Error(error.message ?: "Failed to load predictions")
                }
        }
    }

    fun refresh() {
        loadPredictions()
    }
}

sealed class PredictionsUiState {
    object Loading : PredictionsUiState()
    data class Success(val predictions: PredictionsData) : PredictionsUiState()
    data class Error(val message: String) : PredictionsUiState()
}

@HiltViewModel
class LedgerViewModel @Inject constructor(
    private val ledgerRepository: LedgerRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LedgerUiState>(LedgerUiState.Loading)
    val uiState: StateFlow<LedgerUiState> = _uiState.asStateFlow()

    init {
        loadEntries()
    }

    fun loadEntries() {
        viewModelScope.launch {
            _uiState.value = LedgerUiState.Loading
            ledgerRepository.getLedgerEntries()
                .onSuccess { entries ->
                    _uiState.value = LedgerUiState.Success(entries.sortedByDescending { it.entryDate })
                }
                .onFailure { error ->
                    _uiState.value = LedgerUiState.Error(error.message ?: "Failed to load ledger")
                }
        }
    }

    fun refresh() {
        loadEntries()
    }

    fun addEntry(entry: LedgerEntry, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            ledgerRepository.createEntry(entry)
                .onSuccess {
                    loadEntries()
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.value = LedgerUiState.Error(error.message ?: "Failed to add entry")
                }
        }
    }
}

sealed class LedgerUiState {
    object Loading : LedgerUiState()
    data class Success(val entries: List<LedgerEntry>) : LedgerUiState()
    data class Error(val message: String) : LedgerUiState()
}
