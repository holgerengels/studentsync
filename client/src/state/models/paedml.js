import { createModel } from '@captaincodeman/rdx-model';
import { endpoint } from "../endpoint";
export default createModel({
    state: {
        entities: [],
        filtered: [],
        filter: "",
        timestamp: 0,
        loading: false,
        error: "",
    },
    reducers: {
        requestList(state) {
            return { ...state, loading: true, error: "" };
        },
        receivedList(state, payload) {
            return { ...state,
                entities: payload,
                filtered: [],
                timestamp: Date.now(),
                loading: false,
            };
        },
        requestFiltered(state, payload) {
            return { ...state, filter: payload, loading: true, error: "" };
        },
        receivedFiltered(state, payload) {
            return { ...state,
                filtered: payload,
                loading: false,
            };
        },
        unsetFilter(state) {
            return { ...state, filter: "", loading: false };
        },
        error(state, message) {
            return { ...state,
                loading: false,
                syncing: false,
                error: message,
            };
        },
    },
    effects: (store) => ({
        async load() {
            const dispatch = store.dispatch();
            const state = store.getState();
            if (Date.now() - state.paedml.timestamp > 3000) {
                dispatch.paedml.requestList();
                // @ts-ignore
                const resp = await fetch(endpoint.list("paedml"), endpoint.get);
                if (resp.ok) {
                    const json = await resp.json();
                    dispatch.paedml.receivedList(json);
                }
                else {
                    const message = await resp.text();
                    // @ts-ignore
                    dispatch.paedml.error(message);
                }
            }
        },
        async filter(payload) {
            const dispatch = store.dispatch();
            if (payload && payload.length > 2) {
                dispatch.paedml.requestFiltered(payload);
                // @ts-ignore
                const resp = await fetch(endpoint.filter("asv", payload), endpoint.get);
                if (resp.ok) {
                    const json = await resp.json();
                    dispatch.paedml.receivedFiltered(json);
                }
                else {
                    const message = await resp.text();
                    // @ts-ignore
                    dispatch.paedml.error(message);
                }
            }
            else if (!payload || payload.length === 0) {
                dispatch.paedml.unsetFilter();
                dispatch.paedml.load();
            }
        },
        'routing/change': async function (payload) {
            const dispatch = store.dispatch();
            switch (payload.page) {
                case 'page-paedml':
                    dispatch.paedml.load();
                    break;
            }
        }
    })
});
//# sourceMappingURL=paedml.js.map