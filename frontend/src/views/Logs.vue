<template>
  <div class="logs">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>Sync Logs</h2>
      <wa-button variant="neutral" @click="fetchLogs" :disabled="loading" size="small">
        <wa-icon name="arrow-clockwise" slot="prefix"></wa-icon> Aktualisieren
      </wa-button>
    </div>
    
    <p>Historie der Synchronisierungs- und ID-Generierungsvorgänge.</p>
    
    <div v-if="loading" style="display: flex; justify-content: center; padding: 2rem;">
      <wa-spinner style="font-size: 2rem;"></wa-spinner>
    </div>
    
    <div v-else>
      <wa-card style="width: 100%; margin-top: 1rem; overflow-x: auto;">
        <table class="log-table">
          <thead>
            <tr>
              <th>Startzeit</th>
              <th>Task</th>
              <th>Auslöser</th>
              <th>Status</th>
              <th>Dauer (ms)</th>
              <th>Zusammenfassung</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log._id">
              <td>{{ new Date(log.startTime).toLocaleString() }}</td>
              <td><wa-tag size="small">{{ log.task }}</wa-tag></td>
              <td>{{ log.trigger }}</td>
              <td>
                <wa-tag size="small" :variant="log.status === 'SUCCESS' ? 'success' : log.status === 'ERROR' ? 'danger' : 'warning'">
                  {{ log.status }}
                </wa-tag>
              </td>
              <td>{{ log.durationMs || '-' }}</td>
              <td>
                <span class="diff-summary" v-html="log.summaryHtml || '-'"></span>
              </td>
              <td>
                <wa-button 
                   variant="text" 
                   size="small" 
                   @click="showDetails(log)"
                   :title="log.details ? 'Details / Diffs ansehen' : 'Keine Details vorhanden'">
                  <wa-icon name="list-ul" style="font-size: 1.1rem;"></wa-icon>
                </wa-button>
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="7" style="text-align: center; padding: 2rem;">Keine Logs gefunden.</td>
            </tr>
          </tbody>
        </table>
      </wa-card>
    </div>

    <wa-dialog ref="dialogEl" label="Log Details & Diffs" style="--width: 80vw;">
      <div v-if="selectedLog">
        <div style="margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
           <strong>ID:</strong> {{ selectedLog._id }}
           <strong>Task:</strong> {{ selectedLog.task }}
           <strong>Beginn:</strong> {{ new Date(selectedLog.startTime).toLocaleString() }}
           <strong>Status:</strong> {{ selectedLog.status }}
        </div>
        
        <div v-if="!selectedLog.details || Object.keys(selectedLog.details).length === 0">
           <p style="color: #666;">Für diesen Eintrag liegen keine tiefergehenden Daten oder Diffs vor (möglicherweise älter als 14 Tage und bereits bereinigt).</p>
        </div>
        <div v-else>
           <pre class="json-viewer">{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
        </div>
      </div>
    </wa-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import axios from 'axios';

const logs = ref([]);
const loading = ref(false);

const dialogEl = ref(null);
const selectedLog = ref(null);

const fetchLogs = async () => {
  loading.value = true;
  try {
    const res = await axios.get('http://localhost:3001/api/logs?limit=50');
    logs.value = res.data;
  } catch(e) {
    console.error('Fehler beim Laden der Logs:', e);
  } finally {
    loading.value = false;
  }
};

const showDetails = async (log) => {
  selectedLog.value = log;
  await nextTick();
  if (dialogEl.value) {
    dialogEl.value.show();
  }
};

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.log-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.log-table th, .log-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}
.log-table th {
  background: #fafafa;
  font-weight: 600;
}
.log-table tr:hover {
  background: #f9f9f9;
}
.diff-summary {
  display: inline-flex;
  gap: 0.5rem;
  font-weight: bold;
}
.diff-add { color: #10B981; }
.diff-change { color: #F59E0B; }
.diff-remove { color: #EF4444; }

.json-viewer {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 50vh;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9rem;
}

/* Fix width handling for WA card */
wa-card::part(base) {
  padding: 0;
}
wa-card::part(body) {
  padding: 0;
}
</style>
