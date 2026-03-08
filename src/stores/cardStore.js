import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCardStore = defineStore('cards', () => {
  const cards = ref([])
  const loading = ref(false)

  const addCard = (card) => {
    cards.value.unshift({
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...card
    })
  }

  const removeCard = (id) => {
    cards.value = cards.value.filter(card => card.id !== id)
  }

  const updateCard = (id, updates) => {
    const index = cards.value.findIndex(card => card.id === id)
    if (index !== -1) {
      cards.value[index] = { ...cards.value[index], ...updates }
    }
  }

  const getCardById = (id) => {
    return cards.value.find(card => card.id === id)
  }

  return {
    cards,
    loading,
    addCard,
    removeCard,
    updateCard,
    getCardById
  }
})
