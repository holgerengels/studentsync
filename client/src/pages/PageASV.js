import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-icon-button';
import '@material/mwc-top-app-bar';
import 'lit-virtualizer/lit-virtualizer';
import { colorStyles, fontStyles } from "../sync-styles";
import { renderStudent, helperStyles } from "./helper";
let PageASV = class PageASV extends connect(store, LitElement) {
    constructor() {
        super();
        this._loading = false;
        this._showFilter = false;
        this._students = [];
        this._error = "";
        this._filter = this._debounce(this._filter.bind(this), 1000, false);
    }
    mapState(state) {
        return {
            _loading: state.asv.loading,
            _students: state.asv.filter !== "" ? state.asv.filtered : state.asv.entities,
            _error: state.asv.error,
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
        input {
          border: none;
          border-bottom: 2px solid white;
          background-color: transparent;
          color: white;
          outline: none;
          width: 100%;
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
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${this._toggleDrawer}"></mwc-icon-button>
        <div slot="title" ?hidden="${this._showFilter}">ASV</div>
        <div slot="title" ?hidden="${!this._showFilter}"><input id="input" type="text" @input="${this._input}" @keydown="${this._keydown}"/></div>
        <mwc-icon-button icon="search" slot="actionItems" @click="${this._toggleFilter}"></mwc-icon-button>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asv.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
      ${!this._error ? html `
        <lit-virtualizer style="height: 100%" .items=${this._students} .renderItem="${renderStudent}"></lit-virtualizer>
      ` : html `
        <div class="message">
            <b>Fehlermeldung</b><br/><br/>
            ${this._error}
        </div>
      `}
      </div>
    `;
    }
    _toggleFilter() {
        if (!this.shadowRoot)
            return;
        this._showFilter = !this._showFilter;
        if (this._showFilter) { // @ts-ignore
            this.shadowRoot.getElementById("input").focus();
        }
    }
    _keydown(e) {
        if (e.key === "Escape") {
            store.dispatch.asv.filter("");
            this._showFilter = false;
        }
    }
    _input(e) {
        this._filter(e.srcElement.value);
    }
    _filter(filter) {
        store.dispatch.asv.filter(filter);
    }
    _debounce(func, wait, immediate) {
        var timeout;
        return function (...args) {
            // @ts-ignore
            var context = this;
            var later = function () {
                timeout = null;
                if (!immediate)
                    func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow)
                func.apply(context, args);
        };
    }
    _toggleDrawer() {
        this.dispatchEvent(new CustomEvent("toggleDrawer", { bubbles: true, composed: true }));
    }
};
__decorate([
    property()
], PageASV.prototype, "_loading", void 0);
__decorate([
    property()
], PageASV.prototype, "_showFilter", void 0);
__decorate([
    property()
], PageASV.prototype, "_students", void 0);
__decorate([
    property()
], PageASV.prototype, "_error", void 0);
PageASV = __decorate([
    customElement('page-asv')
], PageASV);
export { PageASV };
//# sourceMappingURL=PageASV.js.map