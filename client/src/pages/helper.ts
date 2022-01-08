import {css, html} from "lit";
import {Student} from "../state/state";

// language=HTML
export const renderStudent = (student: Student) => html`
    <div class="line">
        <span><b>${student.lastName}, ${student.firstName}</b><br/>${student.account}</span>
        <span>${student.gender}<br/>${student.birthday}</span>
        <span>${student.clazz}</span>
    </div>
`;

// language=CSS
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
      content-visibility: auto;
      height: 52px;
  }
  .line > span:nth-of-type(3n+1) {
    flex: 2 1 50%;
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
