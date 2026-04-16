const { ref, computed } = require('vue');
const reportDialogRemnants = ref([{selected: false}, {selected: false}]);
const selectedRemnantsCount = computed(() => {
    return reportDialogRemnants.value.filter(r => r.selected).length;
});
console.log(selectedRemnantsCount.value);
reportDialogRemnants.value[0].selected = true;
console.log(selectedRemnantsCount.value);
