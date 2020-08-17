import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import 'lit-virtualizer/lit-virtualizer';
import { colorStyles, fontStyles } from "../sync-styles";
import { helperStyles, renderDiff } from "./mergehelper";
let PageASVPaedML = class PageASVPaedML extends connect(store, LitElement) {
    constructor() {
        super(...arguments);
        this._loading = false;
        this._diffs = [];
        this._error = "";
    }
    mapState(state) {
        return {
            _loading: state.asvpaedml.loading,
            _diffs: state.asvpaedml.entities,
            _error: state.asvpaedml.error,
        };
    }
    static get styles() {
        // language=CSS
        return [
            fontStyles,
            colorStyles,
            helperStyles,
            css `
        :host {
          display: flex;
          flex-direction: column;
        }
        .board {
          height: 100%;
        }
        .ee {
          text-decoration: line-through;
        }
        [hidden] {
          display: none;
        }
        .message {
          margin: 16px;
        }
    `
        ];
    }
    render() {
        // language=HTML
        return html `
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${() => this._fire('toggleDrawer')}"></mwc-icon-button>
        <div slot="title">ASV → PaedML</div>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvpaedml.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
      ${!this._error ? html `
        <lit-virtualizer style="height: 100%" .items=${this._diffs} .renderItem="${renderDiff}"></lit-virtualizer>
      ` : html `
        <div class="message">
            <b>Fehlermeldung</b><br/><br/>
            ${this._error}
        </div>
      `}
      </div>
    `;
    }
    _fire(name) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }
};
__decorate([
    property()
], PageASVPaedML.prototype, "_loading", void 0);
__decorate([
    property()
], PageASVPaedML.prototype, "_diffs", void 0);
__decorate([
    property()
], PageASVPaedML.prototype, "_error", void 0);
PageASVPaedML = __decorate([
    customElement('page-asvpaedml')
], PageASVPaedML);
export { PageASVPaedML };
//# sourceMappingURL=PageASVPaedML.js.map