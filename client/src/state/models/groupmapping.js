import { createModel } from '@captaincodeman/rdx-model';
import { endpoint } from "../endpoint";
export default createModel({
    state: {
        report: [],
        timestamp: 0,
        executing: false,
        error: "",
    },
    reducers: {
        request(state) {
            return {
                ...state,
                report: [],
                executing: true,
                error: "",
            };
        },
        receivedReport(state, payload) {
            return { ...state,
                report: payload,
                timestamp: Date.now(),
                executing: false,
            };
        },
        error(state, message) {
            return { ...state,
                executing: false,
                error: message,
            };
        },
    },
    effects: (store) => ({
        async execute() {
            const dispatch = store.dispatch();
            dispatch.groupmapping.request();
            // @ts-ignore
            const resp = await fetch(endpoint.task("ad-group-mapping"), endpoint.get);
            if (resp.ok) {
                const json = await resp.json();
                // @ts-ignore
                dispatch.groupmapping.receivedReport(json);
            }
            else {
                const message = await resp.text();
                // @ts-ignore
                dispatch.groupmapping.error(message);
            }
        },
        'routing/change': async function (payload) {
            const dispatch = store.dispatch();
            switch (payload.page) {
                case 'page-main':
                    dispatch.groupmapping.execute();
                    break;
            }
        }
    })
});
//# sourceMappingURL=groupmapping.js.map