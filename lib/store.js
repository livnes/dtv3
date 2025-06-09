import { create } from 'zustand'

/**
 * Store for managing integration health status
 * Used primarily on the accounts page to track connection status
 */
export const useHealthStore = create((set, get) => ({
    // State
    statuses: {}, // { provider: { connected: boolean, lastFetch: string, notes: string } }
    loading: {},  // { provider: boolean }

    // Actions
    setStatus: (provider, data) => set((state) => ({
        statuses: {
            ...state.statuses,
            [provider]: {
                ...state.statuses[provider],
                ...data,
            }
        }
    })),

    setLoading: (provider, isLoading) => set((state) => ({
        loading: {
            ...state.loading,
            [provider]: isLoading
        }
    })),

    // Get status for a specific provider
    getStatus: (provider) => {
        const state = get()
        return state.statuses[provider] || { connected: false, lastFetch: null, notes: null }
    },

    // Check if provider is loading
    isLoading: (provider) => {
        const state = get()
        return state.loading[provider] || false
    },

    // Clear all statuses
    clearStatuses: () => set({ statuses: {}, loading: {} }),

    // Update multiple statuses at once
    updateStatuses: (statusMap) => set((state) => ({
        statuses: {
            ...state.statuses,
            ...statusMap
        }
    }))
}))

/**
 * Store for managing Analytics properties cache
 * Reduces API calls and provides instant access to property data
 */
export const usePropertiesStore = create((set, get) => ({
    // State
    properties: [], // Array of discovered properties: [{ id, name, accountName }]
    lastFetched: null, // Timestamp of last fetch
    loading: false,
    error: null,

    // Actions
    setProperties: (properties) => set({
        properties,
        lastFetched: new Date().toISOString(),
        error: null
    }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error, loading: false }),

    // Get property by ID
    getPropertyById: (propertyId) => {
        const state = get()
        return state.properties.find(p => p.id === propertyId)
    },

    // Get property name by ID (returns name or ID as fallback)
    getPropertyName: (propertyId) => {
        const state = get()
        const property = state.properties.find(p => p.id === propertyId)
        return property?.name || propertyId
    },

    // Check if cache is fresh (less than 5 minutes old)
    isCacheFresh: () => {
        const state = get()
        if (!state.lastFetched) return false
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        return new Date(state.lastFetched) > fiveMinutesAgo
    },

    // Clear cache
    clearCache: () => set({
        properties: [],
        lastFetched: null,
        error: null
    })
}))

export default useHealthStore 