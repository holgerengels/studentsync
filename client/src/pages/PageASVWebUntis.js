import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import 'lit-virtualizer/lit-virtualizer';
import { colorStyles, fontStyles } from "../sync-styles";
import { helperStyles, renderDiff } from "./mergehelper";
let PageASVWebUntis = class PageASVWebUntis extends connect(store, LitElement) {
    constructor() {
        super(...arguments);
        this._loading = false;
        this._diffs = [];
        this._error = "";
    }
    mapState(state) {
        return {
            _loading: state.asvwebuntis.loading,
            _diffs: state.asvwebuntis.entities,
            _error: state.asvwebuntis.error,
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
        <div slot="title">ASV → WebUntis</div>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvwebuntis.load}"></mwc-icon-button>
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
], PageASVWebUntis.prototype, "_loading", void 0);
__decorate([
    property()
], PageASVWebUntis.prototype, "_diffs", void 0);
__decorate([
    property()
], PageASVWebUntis.prototype, "_error", void 0);
PageASVWebUntis = __decorate([
    customElement('page-asvwebuntis')
], PageASVWebUntis);
export { PageASVWebUntis };
//# sourceMappingURL=PageASVWebUntis.js.map