import {css, html} from "lit-element";
import {Diff} from "../state/state";

export const renderDiff = (diff: Diff) => html`
    <div class="line">
        <mwc-icon>${_renderIcon(diff)}</mwc-icon>
        <span><b>${_renderAttribute(diff, "lastName")}, ${_renderAttribute(diff, "firstName")}</b><br/>${diff.account}</span>
        <span>${_renderAttribute(diff, "gender")}<br/>${_renderAttribute(diff, "birthday")}</span>
        <span>${_renderAttribute(diff, "clazz")}</span>
    </div>
`;
function _renderIcon(change: Diff): string {
  switch (change.change) {
    case 'added':
      return 'add_circle_outline';
    case 'changed':
      return 'edit';
    case 'removed':
      return 'remove_circle_outline';
    default:
      return 'help_outline';
  }
}

const _renderAttribute = (change: Diff, attribute: string) => html`${change[attribute + "E"] ? html`<span class="ee">${change[attribute + "E"]}</span>` : ''}${change[attribute]}`;

export const helperStyles = css`
          .line {
          width: 100%;
          display: flex;
          flex-flow: row nowrap;
          align-items: stretch;
          color: var(--color-darkgray);
          background-color: var(--color-lightgray);
          padding: 8px 16px;
          box-sizing: border-box;
          border-bottom: 1px solid var(--color-mediumgray);
        }
        .line > mwc-icon {
          flex: 0 1 10%;
        }
        .line > span:nth-of-type(3n+1) {
          flex: 2 1 40%;
        }
        .line > span:nth-of-type(3n+2) {
          flex: 1 1 30%;
        }
        .line > span:nth-of-type(3n+3) {
          flex: 1 1 20%;
          display: flex;
          justify-content: space-around;
          flex-direction: column;
        }
`;
