/* global it, expect, respondWith, fillIn, waitForPopup, $cliqzResults, getLocaliseString */
/* eslint func-names: ["error", "never"] */
/* eslint prefer-arrow-callback: "off" */
/* eslint no-unused-expressions: "off" */

export default function () {
  context('adult question', function () {
    const results = [
      {
        url: 'http://www.xvideos.com/',
        snippet: {
          extra: {
            adult: true,
            alternatives: [],
            language: {}
          },
          title: 'Free Porn Videos - XVIDEOS.COM'
        },
        c_url: 'http://www.xvideos.com/',
        type: 'bm'
      }
    ];
    let resultElement;

    before(function () {
      respondWith({ results });
      fillIn('xvideos');
      return waitForPopup().then(function () {
        resultElement = $cliqzResults()[0];
      });
    });

    it('renders question', function () {
      const questionSelector = '.result.adult-question';
      expect(resultElement).to.contain(questionSelector);
      const question = resultElement.querySelector('.result.adult-question > .padded');
      const questionText = getLocaliseString({
        de: 'Websites mit nicht-jugendfreien Inhalten wurden automatisch geblockt. Weiterhin blockieren?',
        default: 'Websites with explicit content have been blocked automatically. Continue blocking?'
      });
      expect(question.textContent.trim()).to.be.equal(questionText);
    });

    it('renders buttons', function () {
      const buttonsArea = resultElement.querySelector('.buttons');
      expect(buttonsArea).to.exist;
      const showOnceText = getLocaliseString({
        de: 'Diesmal anzeigen',
        default: 'Show once'
      });
      const alwaysText = getLocaliseString({
        de: 'Immer',
        default: 'Always'
      });
      const neverText = getLocaliseString({
        de: 'Nie',
        default: 'Never',
      });
      const buttons = buttonsArea.querySelectorAll('.result');
      expect(buttons[0].textContent.trim()).to.be.equal(showOnceText);
      expect(buttons[1].textContent.trim()).to.be.equal(alwaysText);
      expect(buttons[2].textContent.trim()).to.be.equal(neverText);
    });
  });
}
