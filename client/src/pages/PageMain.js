import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement, query } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import '../cards/diff-card';
import '../cards/task-card';
import { colorStyles, fontStyles } from "../sync-styles";
import { endpoint } from "../state/endpoint";
let PageMain = class PageMain extends connect(store, LitElement) {
    constructor() {
        super(...arguments);
        this._asvuntis = {};
        this._asvwebuntis = {};
        this._asvpaedml = {};
        this._idgenerator = {};
        this._groupmapping = {};
        this._teacherids = {};
    }
    mapState(state) {
        return {
            // @ts-ignore
            route: state.routing,
            _asvuntis: state.asvuntis,
            _asvwebuntis: state.asvwebuntis,
            _asvpaedml: state.asvpaedml,
            _idgenerator: state.idgenerator,
            _groupmapping: state.groupmapping,
            _teacherids: state.teacherids,
        };
    }
    static get styles() {
        // language=CSS
        return [
            fontStyles,
            colorStyles,
            css `
        :host {
          display: flex;
          flex-direction: column;
        }
        .board {
          display: flex;
          flex-flow: row wrap;
          align-items: stretch;
        }
        .board > * {
          margin: 12px;
          width: 320px;
        }
        diff-card mwc-icon-button {
          --mdc-icon-button-size: 24px;
        }
      `
        ];
    }
    render() {
        // language=HTML
        return html `
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${() => this._fire('toggleDrawer')}"></mwc-icon-button>
        <div slot="title">Home</div>
      </mwc-top-app-bar>
      <div class="board">
        <diff-card from="ASV" to="Untis" .diff="${this._asvuntis}" .load="${store.dispatch.asvuntis.load}" list="/sync/asvuntis" color="tertiary">
            <a id="download"  slot="actions" href="${endpoint.diff('asv', 'untis') + '&file=untis-import&referer=' + location.origin}" download="added.csv" referrerpolicy="origin" hidden></a>
            <mwc-icon-button icon="save_alt" slot="actions" title="Untis Import" @click="${() => this._download.click()}"></mwc-icon-button>
        </diff-card>
        <diff-card from="ASV" to="WebUntis" .diff="${this._asvwebuntis}" .load="${store.dispatch.asvwebuntis.load}" list="/sync/asvwebuntis" color="tertiary"></diff-card>
        <diff-card from="ASV" to="PaedML" .diff="${this._asvpaedml}" .load="${store.dispatch.asvpaedml.load}" .sync="${store.dispatch.asvpaedml.sync}" list="/sync/asvpaedml" color="tertiary"></diff-card>
        <task-card name="ASV ID-Generator" .report="${this._idgenerator}" .execute="${store.dispatch.idgenerator.execute}" color="secondary"></task-card>
        <task-card name="PaedML Gruppenzuordnung" .report="${this._groupmapping}" .execute="${store.dispatch.groupmapping.execute}" color="secondary"></task-card>
        <task-card name="Lehrer Externe ID" .report="${this._teacherids}" .execute="${store.dispatch.teacherids.execute}" color="secondary"></task-card>
      </div>
    `;
    }
    _fire(name) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }
};
__decorate([
    property()
], PageMain.prototype, "_asvuntis", void 0);
__decorate([
    property()
], PageMain.prototype, "_asvwebuntis", void 0);
__decorate([
    property()
], PageMain.prototype, "_asvpaedml", void 0);
__decorate([
    property()
], PageMain.prototype, "_idgenerator", void 0);
__decorate([
    property()
], PageMain.prototype, "_groupmapping", void 0);
__decorate([
    property()
], PageMain.prototype, "_teacherids", void 0);
__decorate([
    query('#download')
], PageMain.prototype, "_download", void 0);
PageMain = __decorate([
    customElement('page-main')
], PageMain);
export { PageMain };
//# sourceMappingURL=PageMain.js.map