<template>
  <div :style="`--view-brand-color: ${domain.color || getBrandColor(domain.name)};`">
    <h2 style="border-bottom: 3px solid var(--view-brand-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
      {{ domain.titel || domain.name }}
    </h2>
    
    <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
        <div style="flex-grow: 1; max-width: 400px;">
            <wa-input :value="searchQuery" @wa-input="onSearchInput" @input="onSearchInput" :placeholder="searchPlaceholder" clearable>
                <wa-icon slot="prefix" name="search" title="Suche (live)"></wa-icon>
            </wa-input>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <template v-if="domain.actions && domain.actions.length">
                <wa-button v-for="act in domain.actions" :key="act.name" variant="neutral" size="small" @click="runAction(act)" :loading="actionLoading === act.name">
                    {{ act.name }}
                </wa-button>
            </template>
            <wa-button @click="refreshData" :loading="loading" variant="neutral" size="small">
                <wa-icon slot="prefix" name="arrow-clockwise"></wa-icon>
                Neu laden
            </wa-button>
        </div>
    </div>

    <!-- Action Report Dialog -->
    <wa-dialog :label="dialogTitle" :open="isDialogOpen" @wa-after-hide="isDialogOpen = false" style="--width: 800px; --body-spacing: 0;">
      <div v-if="dialogContent" v-html="dialogContent" style="padding: 1rem; font-size: 0.9em;"></div>
    </wa-dialog>
    <div v-if="error" class="error">{{ error }}</div>
    
    <wa-card v-if="identities.length" class="table-card">
        <table class="data-table">
            <thead>
                <tr>
                    <th v-for="key in displayKeys" :key="key" @click="toggleSort(key)" style="cursor: pointer; user-select: none; color: var(--view-brand-color);" class="sortable-header">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>{{ key }}</span>
                            <span v-if="sortKey === key" style="color: var(--view-brand-color);">
                                <wa-icon :name="sortAsc ? 'chevron-down' : 'chevron-up'"></wa-icon>
                            </span>
                            <span v-else style="color: transparent; font-size: 0.8em; opacity: 0.3;">
                                <wa-icon name="chevron-down"></wa-icon>
                            </span>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="ident in identities" :key="ident.userId || Math.random()">
                    <td v-for="key in displayKeys" :key="key">{{ ident[key] !== undefined && ident[key] !== null && ident[key] !== '' ? ident[key] : '-' }}</td>
                </tr>
            </tbody>
        </table>
        <div v-if="total > 0" class="pagination-controls" style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--wa-color-neutral-200);">
            <div style="color: gray; font-size: 0.9em;">
                Zeige {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, total) }} von {{ total }}
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <wa-button size="small" variant="neutral" :disabled="page <= 1" @click="page--; fetchData(false)">
                    <wa-icon slot="prefix" name="chevron-left"></wa-icon> Zurück
                </wa-button>
                <wa-button size="small" variant="neutral" :disabled="page * limit >= total" @click="page++; fetchData(false)">
                    Weiter <wa-icon slot="suffix" name="chevron-right"></wa-icon>
                </wa-button>
            </div>
        </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { getBrandColor } from '../utils/brandColors.js';
import { useToast } from '../composables/useToast';

const toast = useToast();

const props = defineProps({
    domain: Object,
    category: Object
});

const identities = ref([]);
const loading = ref(false);
const actionLoading = ref('');
const error = ref('');
const dialogTitle = ref('');
const dialogContent = ref('');
const isDialogOpen = ref(false);
const searchQuery = ref('');
const sortKey = ref('');
const sortAsc = ref(true);
const page = ref(1);
const limit = ref(50);
const total = ref(0);
let searchTimeout = null;

function onSearchInput(event) {
    searchQuery.value = event.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        page.value = 1;
        fetchData(false);
    }, 300);
}

onMounted(() => {
    fetchData(false);
});

watch(() => props.domain.name, () => {
    identities.value = [];
    page.value = 1;
    searchQuery.value = '';
    sortKey.value = '';
    fetchData(false);
});

async function refreshData() {
    await fetchData(true);
}

async function fetchData(forceRefresh) {
    loading.value = true;
    error.value = '';
    try {
        const params = new URLSearchParams({
            page: page.value,
            limit: limit.value
        });
        if (searchQuery.value.trim()) params.append('q', searchQuery.value.trim());
        if (sortKey.value) {
            params.append('sort', sortKey.value);
            params.append('order', sortAsc.value ? 'asc' : 'desc');
        }

        const url = `/api/identities/${props.domain.name}${forceRefresh ? '?refresh=true&' : '?'}${params.toString()}`;
        const res = await axios.get(url);
        
        identities.value = res.data.data || res.data;
        total.value = res.data.total || identities.value.length;
    } catch(e) {
        error.value = 'Failed to load identities from backend';
    } finally {
        loading.value = false;
    }
}

async function runAction(act) {
    const actionKey = act.endpoint || act.run || act.task;
    if (!actionKey) return;
    
    actionLoading.value = act.name;
    error.value = '';
    
    try {
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        
        const msgHtml = res.data?.html || `Aktion ${act.name} ausgeführt`;
        toast.show(msgHtml, 'success');
        
        // Refresh domain data silently to reflect the new state
        await fetchData(true);
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        toast.danger(`Aktion ${act.name} fehlgeschlagen: ${explanation}`);
    } finally {
        actionLoading.value = '';
    }
}

const displayKeys = computed(() => {
    if (identities.value.length === 0) return [];
    // Just gather keys from first item generically, but hide technical or redundant fields
    return Object.keys(identities.value[0]).filter(k => k !== '_id' && k !== '__v' && k !== 'domain');
});

function toggleSort(key) {
    if (sortKey.value === key) {
        if (sortAsc.value) {
            sortAsc.value = false;
        } else {
            sortKey.value = '';
            sortAsc.value = true;
        }
    } else {
        sortKey.value = key;
        sortAsc.value = true;
    }
    page.value = 1;
    fetchData(false);
}

const searchFields = computed(() => props.category?.search || ['userId', 'firstName', 'lastName']);
const filterFields = computed(() => props.category?.filter || []);

const searchPlaceholder = computed(() => {
    if (filterFields.value.length) {
        return `Suchen... (Text oder @${filterFields.value[0]})`;
    }
    return 'Suchen...';
});

</script>

<style scoped>
.table-card {
    width: 100%;
    overflow-x: auto;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
}
.data-table th, .data-table td {
    border: 1px solid var(--wa-color-neutral-200);
    padding: 0.5rem;
    text-align: left;
}
.data-table th {
    background-color: var(--wa-color-neutral-100);
}
.error {
    color: var(--wa-color-danger-600);
    margin-bottom: 1rem;
}

.sortable-header:hover span:last-child {
    color: var(--wa-color-neutral-400) !important;
}
</style>
