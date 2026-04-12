<template>
  <div class="diffs">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>Diffs vergleichen</h2>
      <wa-button variant="neutral" @click="loadDiffs(true)" size="small">
        <wa-icon name="arrow-clockwise" slot="prefix"></wa-icon> Aktualisieren
      </wa-button>
    </div>
    
    <div class="selectors" style="align-items: center; gap: 1rem; margin-bottom: 2rem;">
      <wa-select placeholder="Quell-Domain" v-model="sourceDomain" @wa-change="loadDiffs(false)" style="width: 200px;">
        <wa-option value="asv">ASV</wa-option>
        <wa-option value="untis">Untis</wa-option>
      </wa-select>
      <span style="font-size: 1.5rem; color: #666;">➔</span>
      <wa-select placeholder="Ziel-Domain" v-model="targetDomain" @wa-change="loadDiffs(false)" style="width: 200px;">
        <wa-option value="untis">Untis</wa-option>
        <wa-option value="schulkonsole">Schulkonsole</wa-option>
        <wa-option value="webuntis">WebUntis</wa-option>
      </wa-select>
    </div>

    <div v-if="loading" style="margin-top: 2rem; display: flex; align-items: center; gap: 1rem; font-size: 1.2rem;">
      <wa-spinner style="font-size: 2rem;"></wa-spinner> Berechne Diffs...
    </div>

    <div v-else-if="diffData" style="margin-top: 2rem;">
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <wa-card style="flex: 1;">
          <div slot="header" style="color: green; font-weight: bold;">Hinzufügen ({{ diffData.added.length }})</div>
          <ul style="max-height: 300px; overflow-y: auto; padding-left: 1rem; margin: 0;">
            <li v-for="i in diffData.added.slice(0, 100)" :key="i.account" style="margin-bottom: 4px;">
              <strong>{{ i.account || i.id }}</strong>: {{ i.firstName }} {{ i.lastName }} <span v-if="i.clazz">({{ i.clazz }})</span>
            </li>
            <li v-if="diffData.added.length > 100" style="color: #666; font-style: italic;">... und {{ diffData.added.length - 100 }} weitere</li>
            <li v-if="diffData.added.length === 0" style="color: #666; font-style: italic; list-style: none;">Keine Accounts zum Hinzufügen.</li>
          </ul>
        </wa-card>
        
        <wa-card style="flex: 1;">
          <div slot="header" style="color: red; font-weight: bold;">Entfernen ({{ diffData.removed.length }})</div>
          <ul style="max-height: 300px; overflow-y: auto; padding-left: 1rem; margin: 0;">
            <li v-for="i in diffData.removed.slice(0, 100)" :key="i.account" style="margin-bottom: 4px;">
              <strong>{{ i.account || i.id }}</strong>: {{ i.firstName }} {{ i.lastName }} <span v-if="i.clazz">({{ i.clazz }})</span>
            </li>
            <li v-if="diffData.removed.length > 100" style="color: #666; font-style: italic;">... und {{ diffData.removed.length - 100 }} weitere</li>
            <li v-if="diffData.removed.length === 0" style="color: #666; font-style: italic; list-style: none;">Keine Accounts zum Entfernen.</li>
          </ul>
        </wa-card>
      </div>

      <wa-card style="width: 100%;">
        <div slot="header" style="color: orange; font-weight: bold;">Ändern ({{ diffData.changed.length }})</div>
        <div style="max-height: 400px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #ccc;">
                <th style="padding: 8px;">Account</th>
                <th style="padding: 8px;">Name</th>
                <th style="padding: 8px;">Feld</th>
                <th style="padding: 8px;">Quelle ({{ sourceDomain }})</th>
                <th style="padding: 8px;">Ziel ({{ targetDomain }})</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in diffData.changed.slice(0, 100)" :key="item.source.account">
                <tr v-for="(diff, index) in getDifferences(item)" :key="diff.key" style="border-bottom: 1px solid #efefef;">
                  <td style="padding: 8px;" v-if="index === 0" :rowspan="getDifferences(item).length">
                    <strong>{{ item.source.account || item.source.id }}</strong>
                  </td>
                  <td style="padding: 8px;" v-if="index === 0" :rowspan="getDifferences(item).length">
                    {{ item.source.firstName }} {{ item.source.lastName }}
                  </td>
                  <td style="padding: 8px; font-weight: bold;">{{ diff.key }}</td>
                  <td style="padding: 8px; color: #d9534f;"><del>{{ diff.old }}</del></td>
                  <td style="padding: 8px; color: #28a745;"><ins>{{ diff.new }}</ins></td>
                </tr>
              </template>
              <tr v-if="diffData.changed.length > 100">
                <td colspan="5" style="padding: 8px; text-align: center; color: #666; font-style: italic;">
                  ... und {{ diffData.changed.length - 100 }} weitere geänderte Identitäten
                </td>
              </tr>
              <tr v-if="diffData.changed.length === 0">
                <td colspan="5" style="padding: 8px; text-align: center; color: #666; font-style: italic;">
                  Keine Änderungen gefunden.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </wa-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();

const sourceDomain = ref('asv');
const targetDomain = ref('schulkonsole');
const diffData = ref(null);
const loading = ref(false);

const getDifferences = (item) => {
  const diffs = [];
  const keys = diffData.value?.intersectedProperties || ['firstName', 'lastName', 'clazz', 'birthday', 'gender', 'email'];
  for (const key of keys) {
    const sVal = item.source[key] || '';
    const tVal = item.target[key] || '';
    if (sVal !== tVal) {
      diffs.push({
        key,
        old: sVal,
        new: tVal
      });
    }
  }
  return diffs;
};

const loadDiffs = async (forceRefresh = false) => {
  if (!sourceDomain.value || !targetDomain.value) return;
  loading.value = true;
  diffData.value = null;
  try {
    const refreshParam = forceRefresh ? '?refresh=true' : '';
    const res = await axios.get(`http://localhost:3001/api/diffs/${sourceDomain.value}/${targetDomain.value}${refreshParam}`);
    diffData.value = res.data;
  } catch (err) {
    console.error(err);
    alert('Fehler beim Berechnen des Diffs');
  } finally {
    loading.value = false;
  }
};

// React to query parameter changes (e.g. user navigating from dashboard)
watch(() => route.query.target, (newTarget) => {
  if (newTarget) {
    targetDomain.value = newTarget;
    loadDiffs();
  }
});

onMounted(() => {
    if (route.query.target) {
        targetDomain.value = route.query.target;
    }
    loadDiffs();
});
</script>

<style scoped>
.selectors {
  display: flex;
}
</style>
