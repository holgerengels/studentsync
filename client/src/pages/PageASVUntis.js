import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement, query } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import 'lit-virtualizer/lit-virtualizer';
import { colorStyles, fontStyles } from "../sync-styles";
import { helperStyles, renderDiff } from "./mergehelper";
import { endpoint } from "../state/endpoint";
let PageASVUntis = class PageASVUntis extends connect(store, LitElement) {
    constructor() {
        super(...arguments);
        this._loading = false;
        this._diffs = [];
        this._error = "";
    }
    mapState(state) {
        return {
            _loading: state.asvuntis.loading,
            _diffs: state.asvuntis.entities,
            _error: state.asvuntis.error,
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
        <div slot="title">ASV → Untis</div>
        <a id="download" href="${endpoint.diff('asv', 'untis') + '&file=untis-import&referer=' + location.origin}" download="added.csv" hidden></a>
        <mwc-icon-button icon="save_alt" slot="actionItems" title="Untis Import" @click="${() => this._download.click()}"></mwc-icon-button>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvuntis.load}"></mwc-icon-button>
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
], PageASVUntis.prototype, "_loading", void 0);
__decorate([
    property()
], PageASVUntis.prototype, "_diffs", void 0);
__decorate([
    property()
], PageASVUntis.prototype, "_error", void 0);
__decorate([
    query('#download')
], PageASVUntis.prototype, "_download", void 0);
PageASVUntis = __decorate([
    customElement('page-asvuntis')
], PageASVUntis);
export { PageASVUntis };
//# sourceMappingURL=PageASVUntis.js.map