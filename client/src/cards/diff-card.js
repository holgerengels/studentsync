var DiffCard_1;
import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement } from 'lit-element';
import '@material/mwc-icon-button';
import './vu-card';
import '@material/mwc-icon';
import '@material/mwc-ripple';
let DiffCard = DiffCard_1 = class DiffCard extends LitElement {
    constructor() {
        super(...arguments);
        this.from = "<name>";
        this.to = "<to>";
        this.color = "blue";
        this._error = "";
        this.list = "/";
        this._diff = {};
        this._loading = false;
        this.load = DiffCard_1.NOOP;
        this._sync = DiffCard_1.NOOP;
        this._canSync = false;
    }
    set diff(value) {
        this._diff = value;
        this._error = value.error;
        this._loading = value.loading || value.syncing;
    }
    set sync(value) {
        this._sync = value;
        this._canSync = value !== DiffCard_1.NOOP;
    }
    static get styles() {
        // language=CSS
        return css `
      :host {
        display: block;
      }
      .box {
        min-width: 60px;
        border: 2px solid var(--color-mediumgray);
        text-align: center;
        padding: 4px;
      }
      .nobox {
        min-width: 60px;
        border: 2px solid var(--color-mediumgray);
        text-align: center;
        padding: 4px;
      }
      [hidden] {
        display: none;
      }
      mwc-icon-button, a[slot=footer] {
        --mdc-icon-button-size: 24px;
        margin-left: 8px;
      }
      a[slot=footer] {
        display: inline-block;
        color: unset;
      }
      a[slot=footer] mwc-icon {
        vertical-align: middle;
      }
      `;
    }
    render() {
        // language=HTML
        return html `
        <vu-card .loading="${this._loading}" .error="${this._error}" .color="${this.color}">
            <span slot="header">${this.from} → ${this.to}</span>
            <table slot="content">
                <tr><th>${this.from}</th><td>&nbsp;→&nbsp;</td><th>${this.to}</th><th></th></tr>
                <tr ?hidden="${!this._diff.added}"><td class="box">${this._diff.added}</td><td></td><td class="nobox"></td><td>&nbsp;hinzufügen</td></tr>
                <tr ?hidden="${!this._diff.changed}"><td class="box">${this._diff.changed}</td><td>&nbsp;≠&nbsp;</td><td class="box">${this._diff.changed}</td><td>&nbsp;ändern</td></tr>
                <tr ?hidden="${!this._diff.kept}"><td class="box">${this._diff.kept}</td><td>&nbsp;=&nbsp;</td><td class="box">${this._diff.kept}</td></tr>
                <tr ?hidden="${!this._diff.removed}"><td class="nobox"></td><td></td><td class="box">${this._diff.removed}</td><td>&nbsp;löschen</td></tr>
            </table>
            <span slot="footer"><slot name="actions"></slot></span>
            <a slot="footer" href="${this.list}"><mwc-ripple></mwc-ripple><mwc-icon slot="footer" title="Abweichungen im Detail">list</mwc-icon></a>
            <mwc-icon-button slot="footer" icon="refresh" @click="${this.load}" title="Neu laden"></mwc-icon-button>
            <mwc-icon-button ?hidden="${!this._canSync}" slot="footer" icon="call_merge" @click="${this._sync}" title="Automatischer Abgleich"></mwc-icon-button>
        </vu-card>
    `;
    }
};
DiffCard.NOOP = function () { };
__decorate([
    property()
], DiffCard.prototype, "from", void 0);
__decorate([
    property()
], DiffCard.prototype, "to", void 0);
__decorate([
    property()
], DiffCard.prototype, "color", void 0);
__decorate([
    property()
], DiffCard.prototype, "_error", void 0);
__decorate([
    property()
], DiffCard.prototype, "list", void 0);
__decorate([
    property()
], DiffCard.prototype, "_diff", void 0);
__decorate([
    property()
], DiffCard.prototype, "load", void 0);
__decorate([
    property()
], DiffCard.prototype, "_sync", void 0);
DiffCard = DiffCard_1 = __decorate([
    customElement('diff-card')
], DiffCard);
export { DiffCard };
//# sourceMappingURL=diff-card.js.map