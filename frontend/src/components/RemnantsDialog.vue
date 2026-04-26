<template>
  <wa-dialog :open="open" @wa-after-hide="handleClose" label="Nextcloud Remnants" style="--width: 800px; --body-spacing: 0;">
    
    <div style="padding: 1rem; border-bottom: 1px solid var(--wa-color-neutral-200); display: flex; gap: 0.5rem; align-items: center; background: var(--wa-color-neutral-50);">
        <strong style="margin-right: 0.5rem; font-size: 0.9em;">Auswahl-Helfer:</strong>
        <wa-button size="small" variant="neutral" @click="selectTeachersInDialog">Lehrer:innen</wa-button>
        <wa-button size="small" variant="neutral" @click="selectStudentsInDialog">Schüler:innen</wa-button>
    </div>
    
    <div style="max-height: 60vh; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em;">
            <thead style="position: sticky; top: 0; background: var(--wa-color-neutral-100); box-shadow: 0 1px 2px rgba(0,0,0,0.1); z-index: 1;">
            <tr>
                <th style="padding: 0.75rem 1rem; width: 40px; border-bottom: 2px solid var(--wa-color-neutral-300);">
                    <input type="checkbox" @change="toggleAllRemnants" :checked="allRemnantsSelected" />
                </th>
                <th style="padding: 0.75rem 1rem; border-bottom: 2px solid var(--wa-color-neutral-300);">UID / Account</th>
                <th style="padding: 0.75rem 1rem; border-bottom: 2px solid var(--wa-color-neutral-300);">Anzeigename</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="rem in localRemnants" :key="rem.uid" style="border-bottom: 1px solid var(--wa-color-neutral-200);">
                <td style="padding: 0.5rem 1rem;">
                    <input type="checkbox" v-model="rem.selected" />
                </td>
                <td style="padding: 0.5rem 1rem; font-weight: 500;">{{ rem.uid }}</td>
                <td style="padding: 0.5rem 1rem; color: var(--wa-color-neutral-600);">{{ rem.name }}</td>
            </tr>
            <tr v-if="localRemnants.length === 0">
                <td colspan="3" style="padding: 2rem; text-align: center; color: var(--wa-color-neutral-500);">Keine Remnants gefunden.</td>
            </tr>
            </tbody>
        </table>
    </div>

    <div slot="footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <wa-button variant="neutral" @click="handleClose">Schließen</wa-button>
        
        <wa-button 
            v-if="localRemnants.length > 0" 
            variant="danger" 
            :disabled="selectedRemnantsCount === 0"
            :loading="isPurging"
            @click="purgeSelectedRemnants">
            Auswahl löschen ({{ selectedRemnantsCount }})
        </wa-button>
    </div>
  </wa-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { useToast } from '../composables/useToast';

const props = defineProps({
    open: Boolean,
    remnants: {
        type: Array,
        required: true
    }
});

const emit = defineEmits(['update:open']);
const toast = useToast();

const localRemnants = ref([]);
const isPurging = ref(false);

watch(() => props.remnants, (newVal) => {
    // Clone to local state so we can remove purged items locally
    localRemnants.value = newVal.map(r => ({ ...r, selected: !!r.selected }));
}, { immediate: true });

function handleClose() {
    emit('update:open', false);
}

const selectedRemnantsCount = computed(() => {
    return localRemnants.value.filter(r => r.selected).length;
});

const allRemnantsSelected = computed(() => {
    return localRemnants.value.length > 0 && selectedRemnantsCount.value === localRemnants.value.length;
});

function toggleAllRemnants(e) {
    const isChecked = e.target.checked;
    localRemnants.value.forEach(r => r.selected = isChecked);
}

function selectTeachersInDialog() {
    localRemnants.value.forEach(r => {
        r.selected = r.uid && r.uid.charAt(1) === '.';
    });
}

function selectStudentsInDialog() {
    localRemnants.value.forEach(r => {
        r.selected = r.uid && r.uid.includes('.') && r.uid.charAt(1) !== '.';
    });
}

async function purgeSelectedRemnants() {
    const selectedUids = localRemnants.value.filter(r => r.selected).map(r => r.uid);
    if (selectedUids.length === 0) return;
    
    isPurging.value = true;
    
    try {
        const res = await axios.post('/api/execute/nextcloud-remnants-purge', { uids: selectedUids });
        if (res.data && res.data.status === 'success') {
            if (res.data.report.devMode && selectedUids.length > 1) {
                toast.warning(`Erfolgreich gelöscht: ${res.data.report.purged} (DEV MODE aktiv: Nur erstes Element verarbeitet)`);
            } else {
                toast.success(`Erfolgreich gelöscht: ${res.data.report.purged} Einträge`);
            }
            
            // Remove successfully purged UIDs from the table
            let purgedUids = [];
            if (res.data.report.details && Array.isArray(res.data.report.details)) {
                purgedUids = res.data.report.details.filter(d => !d.error).map(d => d.uid);
            }
            if (purgedUids.length > 0) {
                localRemnants.value = localRemnants.value.filter(r => !purgedUids.includes(r.uid));
            }
        } else {
            toast.danger(`Fehler beim Löschen: ${res.data?.error || 'Unbekannt'}`);
        }
    } catch(e) {
        toast.danger(`Ein Fehler ist aufgetreten: ${e.response?.data?.error || e.message}`);
    } finally {
        isPurging.value = false;
    }
}
</script>
