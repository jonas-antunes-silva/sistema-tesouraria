<template>
  <div class="form-control">
    <label class="label">
      <span class="label-text font-medium">Data</span>
    </label>
    <input
      type="date"
      class="input input-bordered"
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
