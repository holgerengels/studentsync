<template>
  <div style="margin-top: -0.5rem;">
    <!-- h2 Dashboard removed to save space, contextual info is already clear -->
    
    <div class="card-grid">
      <wa-card v-for="d in config?.domains" :key="d.name" class="dashboard-card">
          <div slot="header">
              <strong style="font-size: 1.1rem;">{{ d.titel || d.name }}</strong>
          </div>
          
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; margin-bottom: 0.5rem;">
              <div style="font-size: 1.6rem; font-weight: bold; color: var(--wa-color-primary-600); line-height: 1;">
                  {{ counts[d.name] !== undefined ? counts[d.name] : '-' }}
              </div>
              <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--wa-color-neutral-500); margin-top: 0.25rem;">
                  Identities
              </div>
          </div>
          <div v-if="results[d.name]" class="result-msg" style="text-align: center; margin-bottom: 0.5rem;" v-html="results[d.name]"></div>
          
          <div slot="footer" style="display: flex; justify-content: flex-end; gap: 0.25rem; align-items: center;">
              <template v-if="d.actions && d.actions.length">
                  <wa-button v-for="act in d.actions" :key="act.name" variant="neutral" size="small" @click="runAction(act, d.name)" style="margin-right: auto;">
                      {{ act.name }}
                  </wa-button>
              </template>
              <div style="flex-grow: 1" v-if="!d.actions || !d.actions.length"></div>
              
              <wa-button title="Details ansehen" variant="text" size="small" @click="$router.push('/domain/'+d.name)">
                  <wa-icon name="list"></wa-icon>
              </wa-button>
              
              <wa-button title="Neu laden" variant="text" size="small" @click="refreshDomain(d.name)" :disabled="loading[d.name]">
                  <wa-icon name="arrow-clockwise"></wa-icon>
              </wa-button>
          </div>
      </wa-card>
      
      <!-- Visual Diff Cards -->
      <wa-card v-for="df in config?.diffs" :key="df.name" class="dashboard-card visual-diff-card">
          <div slot="header" style="font-size: 1.1rem; font-weight: bold;">
              {{df.titel}}
          </div>
          
          <div class="vd-body">
              <div class="vd-grid">
                  <!-- Header Row -->
                  <div style="text-align: right; font-size: 0.9rem;">{{ df.source }}</div>
                  <div><span style="color: var(--wa-color-neutral-400); font-size: 0.8rem;">&rarr;</span></div>
                  <div style="font-size: 0.9rem">{{ df.target }}</div>
                  <div></div>
                  
                  <!-- Add Row -->
                  <template v-if="diffStats[df.name]?.added">
                      <div class="vd-box has-val">{{ diffStats[df.name].added }}</div>
                      <div></div>
                      <div class="vd-box"></div>
                      <div class="vd-op-label">hinzufügen</div>
                  </template>
                  
                  <!-- Change Row -->
                  <template v-if="diffStats[df.name]?.changed">
                      <div class="vd-box has-val">{{ diffStats[df.name].changed }}</div>
                      <div class="vd-symbol">&ne;</div>
                      <div class="vd-box has-val">{{ diffStats[df.name].changed }}</div>
                      <div class="vd-op-label">ändern</div>
                  </template>
                  
                  <!-- Unchanged Row -->
                  <template v-if="diffStats[df.name]?.unchanged">
                      <div class="vd-box has-val">{{ diffStats[df.name].unchanged }}</div>
                      <div class="vd-symbol">=</div>
                      <div class="vd-box has-val">{{ diffStats[df.name].unchanged }}</div>
                      <div class="vd-op-label">unverändert</div>
                  </template>
                  
                  <!-- Remove Row -->
                  <template v-if="diffStats[df.name]?.removed">
                      <div class="vd-box"></div>
                      <div></div>
                      <div class="vd-box has-val">{{ diffStats[df.name].removed }}</div>
                      <div class="vd-op-label">löschen</div>
                  </template>
              </div>
          </div>
          
          <div v-if="results[df.name]" class="result-msg" v-html="results[df.name]"></div>
          
          <div slot="footer" style="display: flex; justify-content: flex-end; gap: 0.25rem; align-items: center; flex-wrap: wrap;">
              <!-- Custom tasks attached to diffs -->
              <template v-if="df.actions">
                  <wa-button v-for="act in df.actions" :key="act.name" variant="neutral" size="small" @click="runAction(act, df.name)" style="margin-right: auto;">
                      {{ act.name }}
                  </wa-button>
              </template>
              <div style="flex-grow: 1" v-if="!df.actions || !df.actions.length"></div>
              
              <wa-button title="Synchronisieren" variant="text" size="small" @click="runSync(df)" :disabled="loading[df.name]">
                  <wa-icon name="arrow-repeat"></wa-icon>
              </wa-button>
              
              <wa-button title="Details ansehen" variant="text" size="small" @click="$router.push('/diff/'+df.name)">
                  <wa-icon name="list"></wa-icon>
              </wa-button>
              
              <wa-button title="Neu berechnen" variant="text" size="small" @click="refreshDiff(df.name, true)" :disabled="loading[df.name]">
                  <wa-icon name="arrow-clockwise"></wa-icon>
              </wa-button>
          </div>
      </wa-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const props = defineProps({
    config: Object
});

const loading = ref({});
const results = ref({});
const counts = ref({});
const diffStats = ref({});
const actionLoading = ref('');
const error = ref('');

import { onMounted } from 'vue';

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
        results.value[diffName] = `<span style="color:red">Diff Calc Failed</span>`;
    } finally {
        loading.value[diffName] = false;
    }
}

onMounted(async () => {
    if (!props.config) return;
    if (props.config.domains) {
        for (const d of props.config.domains) {
            try {
                const res = await axios.get(`/api/identities/${d.name}`);
                counts.value[d.name] = res.data?.length || 0;
            } catch (e) {
                counts.value[d.name] = 'Error';
            }
        }
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
        results.value[name] = 'Refresh failed';
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
        results.value[diffName] = `<span style="color:var(--wa-color-danger-600)">Sync Failed</span>`;
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
        if (contextName) {
            results.value[contextName] = `<span style="color:var(--wa-color-danger-600)">Aktion fehlgeschlagen</span>`;
        } else {
            alert(`Failed to execute ${act.name}`);
        }
    } finally {
        if (contextName) loading.value[contextName] = false;
    }
}
</script>

<style scoped>
.card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
}
.dashboard-card {
    display: flex;
    flex-direction: column;
}
.card-header h3 {
    margin: 0;
    font-size: 1.25rem;
}
.card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
}
.result-msg {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: var(--wa-color-success-600);
}

/* Visual Diff Card Base */
.visual-diff-card {
    display: flex;
    flex-direction: column;
}
.vd-body {
    padding: 0;
    display: flex;
    justify-content: center;
}
.vd-grid {
    display: grid;
    grid-template-columns: minmax(50px, max-content) auto minmax(50px, max-content) auto;
    gap: 0.2rem 0.35rem;
    align-items: center;
}
.vd-grid .header {
    font-weight: bold;
    text-align: center;
    color: var(--wa-color-neutral-800);
    margin-bottom: 0.25rem;
    font-size: 0.95rem;
}
.vd-box {
    border: 1px solid var(--wa-color-neutral-400);
    background-color: var(--wa-color-neutral-50);
    min-width: 50px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--wa-color-neutral-800);
    box-sizing: border-box;
    border-radius: 2px;
}
.vd-box.has-val {
    color: var(--wa-color-primary-700);
    font-weight: 600;
}
.vd-op-label {
    padding-left: 0.25rem;
    color: var(--wa-color-neutral-600);
    font-size: 0.85rem;
}
.vd-symbol {
    font-weight: normal;
    text-align: center;
    padding: 0 0.15rem;
    color: var(--wa-color-neutral-500);
    font-size: 0.85rem;
}
.primary-icon-btn::part(base) {
    color: var(--wa-color-primary-600);
}
</style>
