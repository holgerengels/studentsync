import { ref } from 'vue';

const toasts = ref([]);
let nextId = 0;

export function useToast() {
    function show(message, variant = 'success', duration = 4000) {
        const id = nextId++;
        const toast = { id, message, variant };
        toasts.value.push(toast);

        if (duration > 0) {
            setTimeout(() => {
                remove(id);
            }, duration);
        }
    }

    function remove(id) {
        toasts.value = toasts.value.filter(t => t.id !== id);
    }

    function success(message, duration) {
        show(message, 'success', duration);
    }

    function danger(message, duration) {
        show(message, 'danger', duration);
    }

    function warning(message, duration) {
        show(message, 'warning', duration);
    }

    function info(message, duration) {
        show(message, 'primary', duration);
    }

    return {
        toasts,
        show,
        remove,
        success,
        danger,
        warning,
        info
    };
}
