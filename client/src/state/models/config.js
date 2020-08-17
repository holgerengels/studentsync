import { createModel } from '@captaincodeman/rdx-model';
import { endpoint } from "../endpoint";
export default createModel({
    state: {
        config: {},
        reading: false,
        writing: false,
    },
    reducers: {
        requestRead(state) {
            return { ...state, reading: true };
        },
        receivedRead(state, payload) {
            return { ...state,
                config: payload,
                reading: false,
            };
        },
        requestWrite(state) {
            return { ...state, writing: true };
        },
        receivedWrite(state) {
            return { ...state,
                writing: false,
            };
        },
    },
    effects: (store) => ({
        async read() {
            const dispatch = store.dispatch();
            dispatch.config.requestRead();
            // @ts-ignore
            const resp = await fetch(endpoint.settings("read"), endpoint.get);
            const json = await resp.json();
            dispatch.config.receivedRead(json);
        },
        async write(payload) {
            const dispatch = store.dispatch();
            dispatch.config.requestWrite();
            // @ts-ignore
            const resp = await fetch(endpoint.settings("write"), { ...endpoint.post, body: JSON.stringify(payload) });
            await resp.json();
            dispatch.config.receivedWrite();
        },
        'routing/change': async function (payload) {
            const dispatch = store.dispatch();
            switch (payload.page) {
                case 'page-config':
                    dispatch.config.read();
                    break;
            }
        }
    })
});
//# sourceMappingURL=config.js.map