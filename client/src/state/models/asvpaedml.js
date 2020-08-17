import { createModel } from '@captaincodeman/rdx-model';
import { endpoint } from "../endpoint";
export default createModel({
    state: {
        entities: [],
        added: 0,
        changed: 0,
        removed: 0,
        kept: 0,
        timestamp: 0,
        loading: false,
        report: "",
        syncing: false,
        error: "",
    },
    reducers: {
        requestDiff(state) {
            return { ...state, loading: true, error: "" };
        },
        receivedDiff(state, payload) {
            return { ...state,
                added: payload.filter(diff => diff.change === "added").length,
                changed: payload.filter(diff => diff.change === "changed").length,
                removed: payload.filter(diff => diff.change === "removed").length,
                kept: [...payload, { change: "kept", kept: 0 }].filter(diff => diff.change === "kept")[0].kept,
                entities: payload.filter(diff => diff.change !== "kept"),
                report: "",
                timestamp: Date.now(),
                loading: false,
            };
        },
        requestSync(state) {
            return { ...state, syncing: true, error: "" };
        },
        receivedReport(state, payload) {
            return { ...state,
                entities: [],
                added: 0,
                changed: 0,
                removed: 0,
                kept: 0,
                report: payload,
                syncing: false,
            };
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
            if (Date.now() - state.asvpaedml.timestamp > 3000) {
                dispatch.asvpaedml.requestDiff();
                // @ts-ignore
                const resp = await fetch(endpoint.diff("asv", "paedml"), endpoint.get);
                if (resp.ok) {
                    const json = await resp.json();
                    dispatch.asvpaedml.receivedDiff(json);
                }
                else {
                    const message = await resp.text();
                    // @ts-ignore
                    dispatch.asvpaedml.error(message);
                }
            }
        },
        async sync() {
            const dispatch = store.dispatch();
            dispatch.asvpaedml.requestSync();
            // @ts-ignore
            const resp = await fetch(endpoint.sync("asv", "paedml"), endpoint.get);
            if (resp.ok) {
                await resp.json();
                dispatch.asvpaedml.receivedReport("lalilu");
            }
            else {
                const message = await resp.text();
                // @ts-ignore
                dispatch.asvpaedml.error(message);
            }
        },
        'routing/change': async function (payload) {
            const dispatch = store.dispatch();
            switch (payload.page) {
                case 'page-main':
                case 'page-asvpaedml':
                    dispatch.asvpaedml.load();
                    break;
            }
        }
    })
});
//# sourceMappingURL=asvpaedml.js.map