<template>
  <div class="apollo-stack">
    <section class="apollo-block" v-for="item in items" :key="item.id">
      <h3>{{ item.label }}</h3>
      <span class="apollo-value">{{ item.value }}</span>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useConsoleStore } from '../stores/console'
const store = useConsoleStore()
const items = ref(store.summary)
</script>
