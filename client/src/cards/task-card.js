import { __decorate } from "tslib";
import { LitElement, html, css, property, customElement } from 'lit-element';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import './vu-card';
let TaskCard = class TaskCard extends LitElement {
    constructor() {
        super(...arguments);
        this.name = "<name>";
        this.color = "blue";
        this._error = "";
        this._lines = [];
        this._report = {};
        this._executing = false;
        this.execute = function () { };
    }
    set report(value) {
        this._report = value;
        this._error = value.error;
        let date = new Date(value.timestamp).toLocaleDateString() + " " + new Date(value.timestamp).toLocaleTimeString();
        this._lines = [...value.report, { key: "zuletzt ausgeführt", value: date }];
        this._executing = value.executing;
    }
    static get styles() {
        // language=CSS
        return css `
      :host {
        display: block;
      }
      mwc-icon-button {
        --mdc-icon-button-size: 24px;
      }
      li {
        list-style: none;
      }
      `;
    }
    render() {
        // language=HTML
        return html `
        <vu-card .loading="${this._executing}" .error="${this._error}" .color="${this.color}">
            <span slot="header">${this.name}</span>
            <div slot="content">
                ${this._lines.map((line) => html `
                  <li><b>${line['key']}:</b> ${line['value']}</li>
                `)}
            </div>
            <mwc-icon-button slot="footer" icon="play_arrow" @click="${this.execute}" title="Jetzt ausführen"></mwc-icon-button>
        </vu-card>
    `;
    }
};
__decorate([
    property()
], TaskCard.prototype, "name", void 0);
__decorate([
    property()
], TaskCard.prototype, "color", void 0);
__decorate([
    property()
], TaskCard.prototype, "_error", void 0);
__decorate([
    property()
], TaskCard.prototype, "_lines", void 0);
__decorate([
    property()
], TaskCard.prototype, "_report", void 0);
__decorate([
    property()
], TaskCard.prototype, "execute", void 0);
TaskCard = __decorate([
    customElement('task-card')
], TaskCard);
export { TaskCard };
//# sourceMappingURL=task-card.js.map