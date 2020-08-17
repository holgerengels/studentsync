import { __decorate } from "tslib";
import { css, customElement, html, LitElement, property } from 'lit-element';
import { connect } from '@captaincodeman/rdx';
import { store } from '../state/store';
import '@material/mwc-button';
import '@material/mwc-textarea';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-top-app-bar';
import { colorStyles, fontStyles } from "../sync-styles";
let PageConfig = class PageConfig extends connect(store, LitElement) {
    constructor() {
        super(...arguments);
        this._loading = false;
        this._configKeys = [];
        this._configValues = [];
        this._activeIndex = 0;
    }
    mapState(state) {
        return {
            _loading: state.config.reading,
            _configKeys: Object.keys(state.config.config),
            _configValues: Object.keys(state.config.config).map((section) => JSON.stringify(state.config.config[section], null, 3)),
            _validity: Array(Object.keys(state.config.config).length).fill(true)
        };
    }
    // @ts-ignore
    _validateJson(newValue, nativeValidity) {
        try {
            JSON.parse(newValue);
            return {
                valid: true
            };
        }
        catch (e) {
            return {
                valid: false,
                badInput: true,
                customError: true,
            };
        }
    }
    _tabActivated(e) {
        this._activeIndex = e.detail.index;
    }
    _checkValidation(e) {
        let textarea = e.path.find(element => element.tagName === "MWC-TEXTAREA");
        this._validity[this._activeIndex] = textarea.validity.valid;
    }
    _restore() {
        store.dispatch.config.read();
    }
    _save() {
        let config = {};
        for (let i = 0; i < this._configKeys.length; i++) {
            config[this._configKeys[i]] = JSON.parse(this._configValues[i]);
        }
        console.log(JSON.stringify(config, null, 3));
        store.dispatch.config.write(config);
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
          height: 100%;
          padding: 16px;
          display: flex;
          flex-flow: column;
        }
        .ee {
          text-decoration: line-through;
        }
        mwc-icon-button-toggle {
          --mdc-icon-button-size: 24px;
        }
        mwc-textarea {
          margin-bottom: 12px;
        }
        mwc-tab[icon] {
          --mdc-tab-text-label-color-default: var(--color-secondary-dark);
          --mdc-theme-primary: var(--color-secondary-dark);
        }
        [hidden] {
          display: none;
        }
        .buttons {
          display: flex;
          justify-content: flex-end;
        }
    `
        ];
    }
    render() {
        // language=HTML
        return html `
      <mwc-top-app-bar id="bar" dense>
        <mwc-icon-button icon="menu" slot="navigationIcon" @click="${() => this._fire('toggleDrawer')}"></mwc-icon-button>
        <div slot="title">Config</div>
        <mwc-icon-button icon="refresh" slot="actionItems" @click="${store.dispatch.asvuntis.load}"></mwc-icon-button>
      </mwc-top-app-bar>
      <div class="board">
        <mwc-tab-bar @MDCTabBar:activated="${this._tabActivated}">
          ${this._configKeys.map((section, i) => html `
            <mwc-tab label="${section}" ?icon="${!this._validity[i] ? 'error_outline' : null}"></mwc-tab>
          `)}
        </mwc-tab-bar>
        ${this._configKeys.map((section, i) => html `
          <mwc-textarea id="${section}" .value="${this._configValues[i]}" ?hidden="${this._activeIndex !== i}" fullwidth rows="12" @blur="${this._checkValidation}" .validityTransform="${this._validateJson}" @change=${e => this._configValues[i] = e.target.value}></mwc-textarea>
        `)}
        <div class="buttons">
        <mwc-button icon="restore" label="Änderungen verwerfen" @click="${this._restore}"></mwc-button>
        <mwc-button icon="save" label="Änderungen speichern" unelevated @click="${this._save}"></mwc-button>
        </div>
      </div>
    `;
    }
    _fire(name) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }
};
__decorate([
    property()
], PageConfig.prototype, "_loading", void 0);
__decorate([
    property()
], PageConfig.prototype, "_configKeys", void 0);
__decorate([
    property()
], PageConfig.prototype, "_configValues", void 0);
__decorate([
    property()
], PageConfig.prototype, "_activeIndex", void 0);
__decorate([
    property()
], PageConfig.prototype, "_validity", void 0);
PageConfig = __decorate([
    customElement('page-config')
], PageConfig);
export { PageConfig };
//# sourceMappingURL=PageConfig.js.map