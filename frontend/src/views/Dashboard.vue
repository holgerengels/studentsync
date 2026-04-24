<template>
  <div style="margin-top: -0.5rem;">
    <!-- h2 Dashboard removed to save space, contextual info is already clear -->
    
    <div class="card-grid">
      <!-- Domain Cards -->
      <DomainCard 
         v-for="d in config?.domains" :key="d.name"
         :domain="d" 
         :count="counts[d.name]" 
         :loading="loading[d.name]" 
         :result="results[d.name]"
         @run-action="runAction" 
         @refresh="refreshDomain" />
      
      <!-- Visual Diff Cards -->
      <DiffCard 
         v-for="df in config?.diffs" :key="df.name"
         :diff="df"
         :stats="diffStats[df.name]"
         :loading="loading[df.name]"
         :result="results[df.name]"
         @run-action="runAction"
         @refresh="refreshDiff"
         @sync="runSync" />
    </div>
    
    <!-- Generic Action Report Dialog -->
    <wa-dialog :label="reportDialogTitle" :open="isDialogOpen" @wa-after-hide="isDialogOpen = false" style="--width: 800px; --body-spacing: 0;">
      
      <div v-if="toastMessage !== ''" 
           :style="`margin: 1rem; padding: 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.75rem; font-size: 0.9em; font-weight: 500; border: 1px solid var(--wa-color-${toastVariant}-300); background-color: var(--wa-color-${toastVariant}-100); color: var(--wa-color-${toastVariant}-700);`">
        <wa-icon :name="toastVariant === 'success' ? 'check2-circle' : 'exclamation-triangle'" style="font-size: 1.25rem;"></wa-icon>
        <div style="flex-grow: 1;">{{ toastMessage }}</div>
        <div style="cursor: pointer; opacity: 0.7;" @click="toastMessage = ''">
          <wa-icon name="x-lg"></wa-icon>
        </div>
      </div>
      
      <!-- Standard HTML Reports -->
      <div v-if="reportDialogContent" v-html="reportDialogContent" style="padding: 1rem; font-size: 0.9em;"></div>

      <!-- Interactive Vue Table for Remnants -->
      <div v-if="reportDialogRemnants.length > 0">
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
               <tr v-for="rem in reportDialogRemnants" :key="rem.uid" style="border-bottom: 1px solid var(--wa-color-neutral-200);">
                  <td style="padding: 0.5rem 1rem;">
                     <input type="checkbox" v-model="rem.selected" />
                  </td>
                  <td style="padding: 0.5rem 1rem; font-weight: 500;">{{ rem.uid }}</td>
                  <td style="padding: 0.5rem 1rem; color: var(--wa-color-neutral-600);">{{ rem.name }}</td>
               </tr>
            </tbody>
         </table>
         </div>
      </div>

      <div slot="footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <wa-button variant="neutral" @click="isDialogOpen = false">Schließen</wa-button>
          
          <wa-button 
            v-if="reportDialogRemnants.length > 0" 
            variant="danger" 
            :disabled="selectedRemnantsCount === 0"
            :loading="isPurging"
            @click="purgeSelectedRemnants">
            Auswahl löschen ({{ selectedRemnantsCount }})
          </wa-button>
      </div>
    </wa-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import DomainCard from '../components/DomainCard.vue';
import DiffCard from '../components/DiffCard.vue';

const props = defineProps({
    config: Object
});

const loading = ref({});
const results = ref({});
const counts = ref({});
const diffStats = ref({});
const actionLoading = ref('');
const error = ref('');

const isDialogOpen = ref(false);
const reportDialogTitle = ref('');
const reportDialogContent = ref('');
const reportDialogRemnants = ref([]);
const isPurging = ref(false);

const selectedRemnantsCount = computed(() => {
    return reportDialogRemnants.value.filter(r => r.selected).length;
});

const allRemnantsSelected = computed(() => {
    return reportDialogRemnants.value.length > 0 && selectedRemnantsCount.value === reportDialogRemnants.value.length;
});

function toggleAllRemnants(e) {
    const isChecked = e.target.checked;
    reportDialogRemnants.value.forEach(r => r.selected = isChecked);
    reportDialogRemnants.value = [...reportDialogRemnants.value];
}

function toggleRemnant(rem, e) {
    // Explicitly update the object reference so Vue detects the mutation.
    rem.selected = e.target.checked;
    
    // Hack: If deep reactivity fails for any reason, trigger array reassignment
    reportDialogRemnants.value = [...reportDialogRemnants.value];
}

function selectTeachersInDialog() {
    reportDialogRemnants.value.forEach(r => {
        r.selected = r.uid && r.uid.charAt(1) === '.';
    });
    reportDialogRemnants.value = [...reportDialogRemnants.value];
}

function selectStudentsInDialog() {
    reportDialogRemnants.value.forEach(r => {
        r.selected = r.uid && r.uid.charAt(1) !== '.';
    });
    reportDialogRemnants.value = [...reportDialogRemnants.value];
}

const toastMessage = ref('');
const toastVariant = ref('success');

function showToast(message, variant = 'success') {
    toastMessage.value = message;
    toastVariant.value = variant;
    setTimeout(() => { toastMessage.value = ''; }, 4000);
}

async function purgeSelectedRemnants() {
    const selectedUids = reportDialogRemnants.value.filter(r => r.selected).map(r => r.uid);
    if (selectedUids.length === 0) return;
    
    isPurging.value = true;
    toastMessage.value = '';
    
    try {
        const res = await axios.post('/api/execute/nextcloud-remnants-purge', { uids: selectedUids });
        if (res.data && res.data.status === 'success') {
            if (res.data.report.devMode && selectedUids.length > 1) {
                showToast(`Erfolgreich gelöscht: ${res.data.report.purged} (DEV MODE aktiv: Nur erstes Element verarbeitet)`, 'warning');
            } else {
                showToast(`Erfolgreich gelöscht: ${res.data.report.purged} Einträge`, 'success');
            }
            
            // Remove successfully purged UIDs from the table instead of closing the dialog
            let purgedUids = [];
            if (res.data.report.details && Array.isArray(res.data.report.details)) {
                purgedUids = res.data.report.details.filter(d => !d.error).map(d => d.uid);
            }
            if (purgedUids.length > 0) {
                reportDialogRemnants.value = reportDialogRemnants.value.filter(r => !purgedUids.includes(r.uid));
            }
        } else {
            showToast(`Fehler beim Löschen: ${res.data?.error || 'Unbekannt'}`, 'danger');
        }
    } catch(e) {
        showToast(`Ein Fehler ist aufgetreten: ${e.response?.data?.error || e.message}`, 'danger');
    } finally {
        isPurging.value = false;
    }
}

function formatTitel(titelString) {
    if (titelString.includes('—>')) {
        return titelString.split('—>').map(s => s.trim());
    } else if (titelString.includes('->')) {
        return titelString.split('->').map(s => s.trim());
    } else if (titelString.includes('-')) {
        return titelString.split('-').map(s => s.trim());
    }
    return [titelString, '?'];
}

async function refreshDiff(diffName, forceRefresh = false) {
    loading.value[diffName] = true;
    results.value[diffName] = '';
    try {
        const [source, target] = diffName.split('-');
        const url = `/api/diff/${source}/${target}` + (forceRefresh ? '?refresh=true' : '');
        const res = await axios.post(url);
        if (res.data && res.data.summary) {
            diffStats.value[diffName] = res.data.summary;
        }
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        results.value[diffName] = `<span style="color:var(--wa-color-danger-600)">Diff Fehler: ${explanation}</span>`;
    } finally {
        loading.value[diffName] = false;
    }
}

onMounted(async () => {
    if (!props.config) return;
    if (props.config.domains) {
        props.config.domains.forEach(d => {
            axios.get(`/api/identities/${d.name}`)
                .then(res => {
                    counts.value[d.name] = res.data?.length || 0;
                })
                .catch(e => {
                    counts.value[d.name] = 'Error';
                    const explanation = e.response?.data?.error || e.message;
                    results.value[d.name] = `<span style="color:var(--wa-color-danger-600)">Fehler: ${explanation}</span>`;
                });
        });
    }
    if (props.config.diffs) {
        for (const df of props.config.diffs) {
            refreshDiff(df.name, false);
        }
    }
});

async function refreshDomain(name) {
    loading.value[name] = true;
    results.value[name] = '';
    try {
        const res = await axios.get(`/api/identities/${name}?refresh=true`);
        results.value[name] = 'Refreshed successfully';
        counts.value[name] = res.data?.length || 0;
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        results.value[name] = `<span style="color:var(--wa-color-danger-600)">Refresh failed: ${explanation}</span>`;
    } finally {
        loading.value[name] = false;
    }
}

async function runSync(df) {
    const diffName = df.name;
    loading.value[diffName] = true;
    results.value[diffName] = '';
    try {
        let taskName = '';
        if (props.config && props.config.tasks) {
            const t = props.config.tasks.find(x => x.class === 'SyncTask' && x.source === df.source && x.target === df.target);
            if (t) taskName = t.name;
        }
        
        let res;
        if (taskName) {
            res = await axios.post(`/api/execute/${taskName}?refresh=true`);
        } else {
            const parts = diffName.split('-');
            res = await axios.post(`/api/sync/${parts[0]}/${parts[1]}?refresh=true`);
        }
        
        results.value[diffName] = res.data.html || 'Sync finished';
        
        // Auto-invalidate and refresh the target domain count
        refreshDomain((df.target || df.name.split('-')[1]).toLowerCase());
        
        // Auto-invalidate and recalculate the diff card
        refreshDiff(diffName, true);
        
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        results.value[diffName] = `<span style="color:var(--wa-color-danger-600)">Sync Failed: ${explanation}</span>`;
    } finally {
        loading.value[diffName] = false;
    }
}

async function runAction(act, contextName) {
    const actionKey = act.download || act.endpoint || act.run || act.task;
    if (!actionKey) return;
    
    actionLoading.value = act.name;
    error.value = '';
    
    try {
        if (contextName) {
            loading.value[contextName] = true;
            results.value[contextName] = '';
        }
        
        const reqTaskName = actionKey.startsWith('/') ? actionKey.split('/').pop() : actionKey;
        const res = await axios.post(actionKey.startsWith('/') ? actionKey : `/api/execute/${actionKey}`);
        
        // Handle Blob Downloads
        if (act.download && res.data && res.data.report && res.data.report.csvData) {
            const blob = new Blob([res.data.report.csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', res.data.report.filename || 'export.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // Open Dialog configuration
        reportDialogTitle.value = act.name || 'Aktionsbericht';
        reportDialogContent.value = '';
        reportDialogRemnants.value = [];
        let shouldOpenDialog = false;

        // Dedizierte Remnants View Logik
        if (reqTaskName === 'nextcloud-remnants-list' && res.data?.report?.remnants) {
            reportDialogRemnants.value = res.data.report.remnants;
            shouldOpenDialog = true;
        } 
        // Generischer Html / Text output View 
        else if (res.data?.report?.dialogHtml) {
            reportDialogContent.value = res.data.report.dialogHtml;
            shouldOpenDialog = true;
        }

        if (shouldOpenDialog) {
            isDialogOpen.value = true;
        }
        
        if (contextName) {
            results.value[contextName] = res.data.html || `<span style="color:var(--wa-color-success-600)">Aktion ausgeführt</span>`;
            
            // Auto reload contextual layout
            if (contextName.includes('-')) {
                // It's a diff view, just refresh diff
                refreshDiff(contextName, true);
            } else {
                refreshDomain(contextName);
                
                // Diff tables connected to this domain also likely changed!
                if(props.config && props.config.diffs) {
                    for(const df of props.config.diffs) {
                        if(df.name.includes(contextName)) {
                            refreshDiff(df.name, true);
                        }
                    }
                }
            }
        } else {
            alert(`Executed ${act.name} successfully`);
        }
    } catch(e) {
        const explanation = e.response?.data?.error || e.message;
        if (contextName) {
            results.value[contextName] = `<span style="color:var(--wa-color-danger-600)">Fehler: ${explanation}</span>`;
        } else {
            alert(`Failed to execute ${act.name}: ${explanation}`);
        }
    } finally {
        if (contextName) loading.value[contextName] = false;
    }
}
</script>

<style scoped>
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
}
</style>
