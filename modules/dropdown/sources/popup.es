// TODO: remove dependency on autocomplete
import utils from '../core/utils';
import autocomplete from '../autocomplete/autocomplete';
import Results from './results';

export default class {
  constructor(element) {
    this.element = element;
  }

  get query() {
    const ctrl = this.element.mInput.controller;
    return ctrl.searchString.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  get urlbarValue() {
    const urlbar = this.element.mInput;
    return urlbar.value;
  }

  get urlbarVisibleValue() {
    const urlbar = this.element.mInput;
    return urlbar.mInputField.value;
  }

  get isOpen() {
    return this.element.mPopupOpen;
  }

  results() {
    const ctrl = this.element.mInput.controller;
    const resultCount = this.element._matchCount;
    const lastRes = autocomplete.lastResult;
    const rawResults = Array(resultCount).fill().map((_, i) => {
      const data = lastRes && lastRes.getDataAt(i) || {}
      const rawResult = {
        title: ctrl.getCommentAt(i),
        url: ctrl.getValueAt(i),
        description: lastRes && lastRes.getDataAt(i) && lastRes.getDataAt(i).description || '',
        originalUrl: ctrl.getValueAt(i),
        type: ctrl.getStyleAt(i),
        text: this.query,
        data,
        maxNumberOfSlots: (i === 0 ? 3 : 1),
      };
      return rawResult;
    });
    const results = new Results({
      query: this.query,
      queriedAt: autocomplete.lastQueryTime,
      rawResults,
    });

    console.log('results', results);
    return results;
  }
}
