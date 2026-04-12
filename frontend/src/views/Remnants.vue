<template>
  <div class="remnants">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 1rem;">
          <h2>Nextcloud LDAP Remnants</h2>
          <wa-badge variant="danger" v-if="remnants.length > 0">{{ remnants.length }} Verwaist</wa-badge>
      </div>
      <wa-button variant="neutral" @click="loadRemnants" :disabled="loading">
        <wa-icon name="arrow-clockwise" slot="prefix"></wa-icon> Aktualisieren
      </wa-button>
    </div>
    
    <p>Hier werden ehemalige Nextcloud-Accounts angezeigt, die nicht mehr im zentralen Schulnetzwerk (LDAP) existieren, deren Daten aber noch Speicherplatz belegen.</p>
    
    <div v-if="loading" style="margin-top: 2rem; display: flex; align-items: center; gap: 1rem; font-size: 1.2rem;">
      <wa-spinner style="font-size: 2rem;"></wa-spinner> Lade Remnants über sichere SSH-Verbindung...
    </div>

    <wa-card v-if="!loading" style="margin-top: 2rem; width: 100%">
      <div slot="header" style="color: #d9534f; font-weight: bold;">Verwaiste Accounts ({{ remnants.length }})</div>
      
      <div v-if="errorMsg" style="padding: 1rem; color: #d9534f; font-weight: bold; display: flex; align-items: center; gap: 0.5rem;">
        <wa-icon name="exclamation-triangle"></wa-icon> Fehler: {{ errorMsg }}
      </div>
      
      <div v-else-if="remnants.length === 0" style="padding: 1rem; color: #28a745; font-weight: bold; display: flex; align-items: center; gap: 0.5rem;">
        <wa-icon name="check-circle"></wa-icon> Keine verwaisten Accounts gefunden. Die Nextcloud ist sauber.
      </div>
      
      <div v-else style="max-height: 600px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead style="position: sticky; top: 0; background: white; z-index: 1;">
            <tr style="border-bottom: 2px solid #ccc;">
              <th style="padding: 12px;">Account (UserID)</th>
              <th style="padding: 12px;">Anzeigename</th>
              <th style="padding: 12px;">Informationen</th>
              <th style="padding: 12px;">Aktion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in remnants" :key="r.account" style="border-bottom: 1px solid #efefef;">
              <td style="padding: 8px;"><strong>{{ r.account }}</strong></td>
              <td style="padding: 8px;">{{ r.displayName || '-' }}</td>
              <td style="padding: 8px; color: #666; font-size: 0.9em;">{{ r.details || '-' }}</td>
              <td style="padding: 8px;">
                 <wa-button variant="danger" size="small" outline disabled title="Löschfunktion noch nicht implementiert">Löschen</wa-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </wa-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const remnants = ref([]);
const loading = ref(false);
const errorMsg = ref('');

const loadRemnants = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await axios.get('http://localhost:3001/api/nextcloud/remnants');
    remnants.value = res.data;
  } catch (err) {
    console.error(err);
    errorMsg.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadRemnants();
});
</script>

<style scoped>
.remnants {
  padding-bottom: 2rem;
}
tbody tr:hover {
  background-color: #fff5f5;
}
</style>
